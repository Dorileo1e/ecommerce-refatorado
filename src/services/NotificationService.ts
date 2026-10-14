import { IMailProvider, MailResult } from '../providers/IMailProvider';

export interface OrderConfirmation {
  customer: string;
  orderId: number;
  total: number;
  items: { name: string }[];
}

/**
 * Define O QUE enviar (assunto e corpo). COMO enviar é responsabilidade do IMailProvider.
 */
export class NotificationService {
  constructor(private readonly mailProvider: IMailProvider) {}

  async sendOrderConfirmation(order: OrderConfirmation): Promise<MailResult> {
    return this.mailProvider.sendMail({
      to: order.customer,
      subject: `Confirmação do Pedido #${order.orderId}`,
      text: `Olá, seu pedido #${order.orderId} no valor de R$ ${order.total} foi confirmado.`,
      html: `
        <h1>Pedido Confirmado!</h1>
        <p>Olá, seu pedido <b>#${order.orderId}</b> foi processado com sucesso.</p>
        <p>Total: <strong>R$ ${order.total}</strong></p>
        <ul>
          ${order.items.map((item) => `<li>${item.name}</li>`).join('')}
        </ul>
      `,
    });
  }
}
