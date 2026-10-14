import { randomUUID } from 'node:crypto';
import { ILogger } from '../lib/ILogger';
import { IPaymentMethod, PaymentResult } from './IPaymentMethod';

/**
 * Pix SIMULADO (não há integração com gateway real), como o cartão do projeto.
 * Aprova sempre e não exige dados em paymentDetails.
 * Foi adicionado apenas registrando esta classe no app.ts: o OrderService não mudou (OCP).
 */
export class PixPayment implements IPaymentMethod {
  constructor(private readonly logger: ILogger) {}

  async process(amount: number, _details: unknown): Promise<PaymentResult> {
    this.logger.info(`Processando Pix de R$ ${amount}`);
    return { approved: true, transactionId: `pix_${randomUUID()}` };
  }
}
