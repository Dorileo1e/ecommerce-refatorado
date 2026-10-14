import { ProductFactory } from '../domain/ProductFactory';
import {
  PaymentDeclinedError,
  ProductNotFoundError,
  UnsupportedPaymentMethodError,
  ValidationError,
} from '../domain/errors';
import { ILogger } from '../lib/ILogger';
import { IPaymentMethod } from '../payments/IPaymentMethod';
import { IOrderRepository, OrderItemSnapshot } from '../repositories/IOrderRepository';
import { IProductRepository } from '../repositories/IProductRepository';
import { NotificationService } from './NotificationService';

/** Entrada "crua" (vem do corpo da requisição HTTP e não é confiável: o serviço valida). */
export interface RawOrderInput {
  customer?: unknown;
  items?: unknown;
  paymentMethod?: unknown;
  paymentDetails?: unknown;
}

export interface CreateOrderResult {
  orderId: number;
  /** Link de preview do e-mail; null se o e-mail não pôde ser enviado ou não há preview. */
  emailPreview: string | null;
}

interface ValidOrder {
  customer: string;
  items: { productId: number; quantity: number }[];
  paymentMethod: string | undefined;
  paymentDetails: unknown;
}

/**
 * Orquestra o fluxo do pedido: valida -> calcula -> paga -> salva -> notifica.
 * Depende apenas de abstrações (repositórios, formas de pagamento, notificação, log).
 */
export class OrderService {
  constructor(
    private readonly productRepository: IProductRepository,
    private readonly orderRepository: IOrderRepository,
    private readonly paymentMethods: ReadonlyMap<string, IPaymentMethod>,
    private readonly notificationService: NotificationService,
    private readonly logger: ILogger,
  ) {}

  async createOrder(input: RawOrderInput): Promise<CreateOrderResult> {
    // 1. VALIDA
    const order = this.validate(input);

    // 2. CALCULA (produto de domínio -> cada tipo sabe calcular o próprio frete)
    let total = 0;
    const snapshots: OrderItemSnapshot[] = [];

    for (const item of order.items) {
      const data = await this.productRepository.findById(item.productId);
      if (!data) throw new ProductNotFoundError(item.productId);

      const product = ProductFactory.createProduct(data);

      total += product.price * item.quantity;
      total += product.calculateFreight(); // frete por linha do pedido, independente da quantidade

      snapshots.push({
        id: product.id,
        name: product.name,
        type: product.type,
        price: product.price,
        quantity: item.quantity,
      });
    }

    // 3. PAGA
    const paymentMethod = order.paymentMethod ? this.paymentMethods.get(order.paymentMethod) : undefined;
    if (!paymentMethod) throw new UnsupportedPaymentMethodError();

    const payment = await paymentMethod.process(total, order.paymentDetails);
    if (!payment.approved) throw new PaymentDeclinedError(payment.reason);
    this.logger.info(`Pagamento aprovado (${order.paymentMethod}), transação ${payment.transactionId}`);

    // 4. SALVA
    const saved = await this.orderRepository.create({
      customer: order.customer,
      items: snapshots,
      total,
      status: 'confirmed',
    });
    this.logger.info(`Pedido #${saved.id} confirmado: R$ ${total}`);

    // 5. NOTIFICA (o pedido já foi pago e salvo: falha de e-mail não pode derrubá-lo)
    const emailPreview = await this.notify(order.customer, saved.id, total, snapshots);

    return { orderId: saved.id, emailPreview };
  }

  private async notify(
    customer: string,
    orderId: number,
    total: number,
    items: OrderItemSnapshot[],
  ): Promise<string | null> {
    try {
      const { previewUrl } = await this.notificationService.sendOrderConfirmation({ customer, orderId, total, items });
      this.logger.info(`Email enviado: ${previewUrl}`);
      return previewUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Pedido #${orderId} salvo, mas falhou o envio do e-mail: ${message}`);
      return null;
    }
  }

  private validate(input: RawOrderInput): ValidOrder {
    const { customer, items, paymentMethod, paymentDetails } = input;

    if (items === undefined || items === null || (Array.isArray(items) && items.length === 0)) {
      throw new ValidationError('Carrinho vazio');
    }
    if (!Array.isArray(items)) {
      throw new ValidationError('Itens inválidos: items deve ser uma lista');
    }
    if (typeof customer !== 'string' || customer.trim() === '') {
      throw new ValidationError('Cliente inválido: informe o e-mail em customer');
    }

    const validItems = items.map((raw: unknown) => {
      const { productId, quantity } = (raw ?? {}) as Record<string, unknown>;

      if (!Number.isInteger(productId)) {
        throw new ValidationError('Item inválido: productId deve ser um número inteiro');
      }
      if (!Number.isInteger(quantity) || (quantity as number) < 1) {
        throw new ValidationError('Item inválido: quantity deve ser um inteiro maior que zero');
      }

      return { productId: productId as number, quantity: quantity as number };
    });

    return {
      customer,
      items: validItems,
      paymentMethod: typeof paymentMethod === 'string' ? paymentMethod : undefined,
      paymentDetails,
    };
  }
}
