import { randomUUID } from 'node:crypto';
import { ILogger } from '../lib/ILogger';
import { IPaymentMethod, PaymentResult } from './IPaymentMethod';

/** Débito: já existia no sistema legado (apenas logava e aprovava). Comportamento preservado. */
export class DebitCardPayment implements IPaymentMethod {
  constructor(private readonly logger: ILogger) {}

  async process(_amount: number, _details: unknown): Promise<PaymentResult> {
    this.logger.info('Processando débito...');
    return { approved: true, transactionId: `debit_${randomUUID()}` };
  }
}
