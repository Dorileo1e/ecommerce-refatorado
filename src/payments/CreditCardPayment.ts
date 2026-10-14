import { randomUUID } from 'node:crypto';
import { ValidationError } from '../domain/errors';
import { ILogger } from '../lib/ILogger';
import { IPaymentMethod, PaymentResult } from './IPaymentMethod';

interface CreditCardDetails {
  cardNumber: string;
  cvv: string;
}

/** CVV que o gateway simulado sempre recusa (mesma regra do sistema legado). */
const DECLINED_CVV = '000';

export class CreditCardPayment implements IPaymentMethod {
  constructor(private readonly logger: ILogger) {}

  async process(amount: number, details: unknown): Promise<PaymentResult> {
    const card = this.parseDetails(details);

    // Nunca logar número completo nem CVV: só os 4 últimos dígitos.
    this.logger.info(`Processando cartão final ${card.cardNumber.slice(-4)}`);

    // Simulação de gateway
    if (card.cvv === DECLINED_CVV) {
      return { approved: false, reason: 'Cartão recusado' };
    }

    return { approved: true, transactionId: `cc_${randomUUID()}` };
  }

  private parseDetails(details: unknown): CreditCardDetails {
    const { cardNumber, cvv } = (details ?? {}) as Record<string, unknown>;

    if (typeof cardNumber !== 'string' || cardNumber.length < 4 || typeof cvv !== 'string' || cvv === '') {
      throw new ValidationError('Dados do cartão inválidos: informe cardNumber e cvv');
    }

    return { cardNumber, cvv };
  }
}
