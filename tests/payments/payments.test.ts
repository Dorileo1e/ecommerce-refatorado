import { describe, it, expect, vi } from 'vitest';
import { CreditCardPayment } from '../../src/payments/CreditCardPayment';
import { DebitCardPayment } from '../../src/payments/DebitCardPayment';
import { PixPayment } from '../../src/payments/PixPayment';
import { IPaymentMethod } from '../../src/payments/IPaymentMethod';
import { ValidationError } from '../../src/domain/errors';
import { ILogger } from '../../src/lib/ILogger';

function fakeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies ILogger;
}

const CARD = '1234567812345678';

describe('CreditCardPayment', () => {
  it('aprova um cartão válido e devolve um transactionId', async () => {
    const payment = new CreditCardPayment(fakeLogger());
    const result = await payment.process(110, { cardNumber: CARD, cvv: '123' });

    expect(result.approved).toBe(true);
    if (result.approved) expect(result.transactionId).toMatch(/^cc_/);
  });

  it('recusa o cartão com CVV 000 (devolve approved:false, sem lançar exceção)', async () => {
    const payment = new CreditCardPayment(fakeLogger());
    const result = await payment.process(110, { cardNumber: CARD, cvv: '000' });

    expect(result).toEqual({ approved: false, reason: 'Cartão recusado' });
  });

  it.each([
    ['sem paymentDetails', undefined],
    ['paymentDetails nulo', null],
    ['sem cvv', { cardNumber: CARD }],
    ['sem cardNumber', { cvv: '123' }],
    ['cardNumber curto demais', { cardNumber: '12', cvv: '123' }],
    ['cvv que não é texto', { cardNumber: CARD, cvv: 123 }],
  ])('lança ValidationError quando %s', async (_label, details) => {
    const payment = new CreditCardPayment(fakeLogger());
    await expect(payment.process(110, details)).rejects.toBeInstanceOf(ValidationError);
  });

  it('loga apenas os 4 últimos dígitos: nunca o número completo nem o CVV', async () => {
    const logger = fakeLogger();
    await new CreditCardPayment(logger).process(110, { cardNumber: CARD, cvv: '987' });

    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls]);
    expect(logged).toContain('5678');
    expect(logged).not.toContain(CARD);
    expect(logged).not.toContain('987');
  });
});

describe('DebitCardPayment', () => {
  it('aprova (comportamento do legado preservado)', async () => {
    const result = await new DebitCardPayment(fakeLogger()).process(50, undefined);
    expect(result.approved).toBe(true);
  });
});

describe('PixPayment', () => {
  it('aprova e devolve um transactionId de Pix', async () => {
    const result = await new PixPayment(fakeLogger()).process(50, undefined);

    expect(result.approved).toBe(true);
    if (result.approved) expect(result.transactionId).toMatch(/^pix_/);
  });
});

describe('Contrato IPaymentMethod (OCP)', () => {
  it('todas as formas de pagamento são intercambiáveis pela mesma interface', async () => {
    const logger = fakeLogger();
    const methods: IPaymentMethod[] = [new CreditCardPayment(logger), new DebitCardPayment(logger), new PixPayment(logger)];
    const details = { cardNumber: CARD, cvv: '123' };

    for (const method of methods) {
      const result = await method.process(10, details);
      expect(result.approved).toBe(true);
    }
  });
});
