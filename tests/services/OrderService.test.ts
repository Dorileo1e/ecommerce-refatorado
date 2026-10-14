import { describe, it, expect, vi } from 'vitest';
import { OrderService, RawOrderInput } from '../../src/services/OrderService';
import { NotificationService } from '../../src/services/NotificationService';
import { IProductRepository } from '../../src/repositories/IProductRepository';
import { IOrderRepository, NewOrder } from '../../src/repositories/IOrderRepository';
import { IPaymentMethod, PaymentResult } from '../../src/payments/IPaymentMethod';
import { CreditCardPayment } from '../../src/payments/CreditCardPayment';
import { IMailProvider, MailMessage } from '../../src/providers/IMailProvider';
import { ProductData } from '../../src/domain/ProductData';
import {
  PaymentDeclinedError,
  ProductNotFoundError,
  UnknownProductTypeError,
  UnsupportedPaymentMethodError,
  ValidationError,
} from '../../src/domain/errors';

// ---------- fakes em memória ----------
const LIVRO: ProductData = { id: 1, name: 'O Programador Pragmático (Livro Físico)', type: 'physical', price: 100 };
const EBOOK: ProductData = { id: 2, name: 'Clean Code (E-book)', type: 'digital', price: 50 };

const CARD = '1234567812345678';
const VALID_CARD = { cardNumber: CARD, cvv: '123' };

function setup(options: { products?: ProductData[]; failMail?: boolean; failSave?: boolean } = {}) {
  const events: string[] = [];
  const products = options.products ?? [LIVRO, EBOOK];

  const productRepository: IProductRepository = {
    findById: async (id) => products.find((p) => p.id === id) ?? null,
  };

  const orders: (NewOrder & { id: number })[] = [];
  const orderRepository: IOrderRepository = {
    create: async (order) => {
      events.push('save');
      if (options.failSave) throw new Error('banco indisponível');
      const saved = { id: orders.length + 1, ...order };
      orders.push(saved);
      return { id: saved.id };
    },
  };

  const sentMails: MailMessage[] = [];
  const mailProvider: IMailProvider = {
    sendMail: async (message) => {
      events.push('mail');
      if (options.failMail) throw new Error('SMTP fora do ar');
      sentMails.push(message);
      return { previewUrl: 'https://ethereal.email/message/abc123' };
    },
  };

  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  const fakePayment = (result: PaymentResult = { approved: true, transactionId: 'tx_1' }) => {
    const process = vi.fn(async (_amount: number, _details: unknown) => {
      events.push('pay');
      return result;
    });
    const method: IPaymentMethod = { process };
    return { method, process };
  };

  const credit = fakePayment();
  const pix = fakePayment();
  const paymentMethods = new Map<string, IPaymentMethod>([
    ['credit_card', credit.method],
    ['pix', pix.method],
  ]);

  const service = new OrderService(
    productRepository,
    orderRepository,
    paymentMethods,
    new NotificationService(mailProvider),
    logger,
  );

  return { service, events, orders, sentMails, logger, credit, pix, paymentMethods, fakePayment, productRepository, orderRepository, mailProvider };
}

const order = (overrides: RawOrderInput = {}): RawOrderInput => ({
  customer: 'abacaxi123@ethereal.email',
  items: [{ productId: 1, quantity: 1 }],
  paymentMethod: 'credit_card',
  paymentDetails: VALID_CARD,
  ...overrides,
});

// ---------- cenários de sucesso ----------
describe('OrderService: compra de livro físico (Cenário 1)', () => {
  it('cobra R$ 100 + R$ 10 de frete = R$ 110', async () => {
    const { service, credit, orders } = setup();

    await service.createOrder(order());

    expect(credit.process).toHaveBeenCalledWith(110, VALID_CARD);
    expect(orders).toHaveLength(1);
    expect(orders[0].total).toBe(110);
  });

  it('persiste o pedido corretamente: cliente, itens (snapshot), total e status confirmed', async () => {
    const { service, orders } = setup();

    const result = await service.createOrder(order());

    expect(result.orderId).toBe(1);
    expect(orders[0]).toEqual({
      id: 1,
      customer: 'abacaxi123@ethereal.email',
      items: [{ id: 1, name: LIVRO.name, type: 'physical', price: 100, quantity: 1 }],
      total: 110,
      status: 'confirmed',
    });
  });

  it('envia o e-mail de confirmação ao cliente com o total de R$ 110 e devolve o link de preview', async () => {
    const { service, sentMails } = setup();

    const result = await service.createOrder(order());

    expect(sentMails).toHaveLength(1);
    expect(sentMails[0].to).toBe('abacaxi123@ethereal.email');
    expect(sentMails[0].subject).toBe('Confirmação do Pedido #1');
    expect(sentMails[0].text).toContain('R$ 110');
    expect(sentMails[0].html).toContain(`<li>${LIVRO.name}</li>`);
    expect(result).toEqual({ orderId: 1, emailPreview: 'https://ethereal.email/message/abc123' });
  });
});

describe('OrderService: compra de e-book digital (Cenário 2)', () => {
  it('cobra apenas R$ 50: frete zero', async () => {
    const { service, credit, orders, sentMails } = setup();

    await service.createOrder(order({ customer: 'abacate123@ethereal.email', items: [{ productId: 2, quantity: 1 }] }));

    expect(credit.process).toHaveBeenCalledWith(50, VALID_CARD);
    expect(orders[0].total).toBe(50);
    expect(orders[0].items[0]).toMatchObject({ id: 2, type: 'digital', quantity: 1 });
    expect(sentMails[0].text).toContain('R$ 50');
  });
});

describe('OrderService: cálculo com vários itens', () => {
  it('livro + e-book = 100 + 10 + 50 = R$ 160', async () => {
    const { service, orders } = setup();
    await service.createOrder(order({ items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }] }));
    expect(orders[0].total).toBe(160);
  });

  it('frete é por LINHA do pedido, não por unidade: 3 livros na mesma linha = 300 + 10', async () => {
    const { service, orders } = setup();
    await service.createOrder(order({ items: [{ productId: 1, quantity: 3 }] }));
    expect(orders[0].total).toBe(310);
  });

  it('duas linhas de produto físico pagam dois fretes: 2 × (100 + 10) = 220', async () => {
    const { service, orders } = setup();
    await service.createOrder(order({ items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }] }));
    expect(orders[0].total).toBe(220);
  });

  it('e-book em quantidade maior continua sem frete: 3 × 50 = 150', async () => {
    const { service, orders } = setup();
    await service.createOrder(order({ items: [{ productId: 2, quantity: 3 }] }));
    expect(orders[0].total).toBe(150);
  });
});

describe('OrderService: fluxo e formas de pagamento', () => {
  it('executa na ordem: paga -> salva -> notifica', async () => {
    const { service, events } = setup();
    await service.createOrder(order());
    expect(events).toEqual(['pay', 'save', 'mail']);
  });

  it('usa somente a forma de pagamento escolhida (pix) e não toca nas outras', async () => {
    const { service, credit, pix, orders } = setup();

    await service.createOrder(order({ paymentMethod: 'pix', paymentDetails: undefined }));

    expect(pix.process).toHaveBeenCalledWith(110, undefined);
    expect(credit.process).not.toHaveBeenCalled();
    expect(orders).toHaveLength(1);
  });

  it('OCP: uma NOVA forma de pagamento funciona sem alterar o OrderService', async () => {
    const { productRepository, orderRepository, mailProvider, logger, fakePayment, paymentMethods } = setup();
    const boleto = fakePayment();
    const extended = new Map(paymentMethods).set('boleto', boleto.method);
    const service = new OrderService(productRepository, orderRepository, extended, new NotificationService(mailProvider), logger);

    const result = await service.createOrder(order({ paymentMethod: 'boleto' }));

    expect(boleto.process).toHaveBeenCalledWith(110, VALID_CARD);
    expect(result.orderId).toBe(1);
  });
});

// ---------- cenários de falha ----------
describe('OrderService: entrada inválida (nada é cobrado, salvo ou enviado)', () => {
  async function expectRejectedWithoutSideEffects(input: RawOrderInput, errorClass: new (...args: never[]) => Error, message?: string) {
    const ctx = setup();
    const promise = ctx.service.createOrder(input);

    await expect(promise).rejects.toBeInstanceOf(errorClass);
    if (message) await expect(promise).rejects.toThrow(message);
    expect(ctx.events).toEqual([]);
    expect(ctx.orders).toHaveLength(0);
  }

  it('carrinho vazio -> 400 "Carrinho vazio"', async () => {
    await expectRejectedWithoutSideEffects(order({ items: [] }), ValidationError, 'Carrinho vazio');
  });

  it('sem items -> 400 "Carrinho vazio"', async () => {
    await expectRejectedWithoutSideEffects(order({ items: undefined }), ValidationError, 'Carrinho vazio');
  });

  it('items que não é lista -> ValidationError', async () => {
    await expectRejectedWithoutSideEffects(order({ items: 'abc' }), ValidationError, 'items deve ser uma lista');
  });

  it.each([
    ['quantidade zero', { productId: 1, quantity: 0 }],
    ['quantidade negativa', { productId: 1, quantity: -2 }],
    ['quantidade fracionada', { productId: 1, quantity: 1.5 }],
    ['quantidade em texto', { productId: 1, quantity: '2' }],
    ['sem quantidade', { productId: 1 }],
    ['productId em texto', { productId: '1', quantity: 1 }],
    ['sem productId', { quantity: 1 }],
    ['item nulo', null],
  ])('item inválido (%s) -> ValidationError', async (_label, item) => {
    await expectRejectedWithoutSideEffects(order({ items: [item] }), ValidationError);
  });

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['só espaços', '   '],
    ['não é texto', 123],
  ])('cliente %s -> ValidationError', async (_label, customer) => {
    await expectRejectedWithoutSideEffects(order({ customer }), ValidationError, 'Cliente inválido');
  });

  it('produto inexistente -> 400 "Produto 999 não encontrado"', async () => {
    await expectRejectedWithoutSideEffects(
      order({ items: [{ productId: 999, quantity: 1 }] }),
      ProductNotFoundError,
      'Produto 999 não encontrado',
    );
  });

  it.each([
    ['desconhecido', 'bitcoin'],
    ['ausente', undefined],
    ['não é texto', 42],
    ['chave herdada de Object ("constructor")', 'constructor'],
    ['chave herdada de Object ("__proto__")', '__proto__'],
  ])('forma de pagamento %s -> 400 "Método de pagamento não suportado"', async (_label, paymentMethod) => {
    await expectRejectedWithoutSideEffects(
      order({ paymentMethod }),
      UnsupportedPaymentMethodError,
      'Método de pagamento não suportado',
    );
  });

  it('tipo de produto desconhecido no banco -> UnknownProductTypeError (falha interna, nada é cobrado)', async () => {
    const ctx = setup({ products: [{ id: 3, name: 'Assinatura', type: 'subscription', price: 9 }] });

    await expect(ctx.service.createOrder(order({ items: [{ productId: 3, quantity: 1 }] }))).rejects.toBeInstanceOf(
      UnknownProductTypeError,
    );
    expect(ctx.events).toEqual([]);
  });
});

describe('OrderService: falhas de pagamento', () => {
  it('pagamento recusado -> PaymentDeclinedError (402); nada é salvo nem notificado', async () => {
    const ctx = setup();
    const declined = ctx.fakePayment({ approved: false, reason: 'Cartão recusado' });
    ctx.paymentMethods.set('credit_card', declined.method as IPaymentMethod);

    const promise = ctx.service.createOrder(order());

    await expect(promise).rejects.toBeInstanceOf(PaymentDeclinedError);
    await expect(promise).rejects.toMatchObject({ message: 'Cartão recusado', statusCode: 402 });
    expect(ctx.events).toEqual(['pay']);
    expect(ctx.orders).toHaveLength(0);
    expect(ctx.sentMails).toHaveLength(0);
  });

  it('com o CreditCardPayment real, CVV 000 é recusado e nada é salvo nem enviado', async () => {
    const ctx = setup();
    ctx.paymentMethods.set('credit_card', new CreditCardPayment(ctx.logger));

    await expect(
      ctx.service.createOrder(order({ paymentDetails: { cardNumber: CARD, cvv: '000' } })),
    ).rejects.toMatchObject({ message: 'Cartão recusado', statusCode: 402 });
    expect(ctx.orders).toHaveLength(0);
    expect(ctx.sentMails).toHaveLength(0);
  });

  it('com o CreditCardPayment real, dados do cartão ausentes -> ValidationError e nada é salvo', async () => {
    const ctx = setup();
    ctx.paymentMethods.set('credit_card', new CreditCardPayment(ctx.logger));

    await expect(ctx.service.createOrder(order({ paymentDetails: undefined }))).rejects.toBeInstanceOf(ValidationError);
    expect(ctx.orders).toHaveLength(0);
  });

  it('erro inesperado no meio de pagamento é propagado e nada é salvo', async () => {
    const ctx = setup();
    ctx.paymentMethods.set('credit_card', { process: async () => { throw new Error('gateway caiu'); } });

    await expect(ctx.service.createOrder(order())).rejects.toThrow('gateway caiu');
    expect(ctx.orders).toHaveLength(0);
    expect(ctx.sentMails).toHaveLength(0);
  });

  it('nenhum dado de cartão (número ou CVV) é persistido no pedido', async () => {
    const ctx = setup();
    ctx.paymentMethods.set('credit_card', new CreditCardPayment(ctx.logger));

    await ctx.service.createOrder(order({ paymentDetails: { cardNumber: CARD, cvv: '321' } }));

    const persisted = JSON.stringify(ctx.orders);
    expect(persisted).not.toContain(CARD);
    expect(persisted).not.toContain('321');
  });
});

describe('OrderService: falhas de persistência e notificação', () => {
  it('se salvar falhar, o erro é propagado e nenhum e-mail é enviado', async () => {
    const ctx = setup({ failSave: true });

    await expect(ctx.service.createOrder(order())).rejects.toThrow('banco indisponível');
    expect(ctx.events).toEqual(['pay', 'save']);
    expect(ctx.sentMails).toHaveLength(0);
  });

  it('se o e-mail falhar, o pedido continua confirmado: devolve orderId, emailPreview null e registra o erro', async () => {
    const ctx = setup({ failMail: true });

    const result = await ctx.service.createOrder(order());

    expect(result).toEqual({ orderId: 1, emailPreview: null });
    expect(ctx.orders).toHaveLength(1);
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringContaining('SMTP fora do ar'));
  });
});
