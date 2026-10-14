/**
 * Erros esperados de negócio/entrada. Carregam o status HTTP que o controller
 * deve devolver, assim o controller não precisa conhecer as regras de negócio.
 * Qualquer erro que NÃO seja AppError é tratado como falha inesperada (500).
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class ProductNotFoundError extends AppError {
  constructor(productId: number) {
    super(`Produto ${productId} não encontrado`, 400);
  }
}

export class UnsupportedPaymentMethodError extends AppError {
  constructor() {
    super('Método de pagamento não suportado', 400);
  }
}

/** Pagamento recusado pelo meio de pagamento (ex.: cartão recusado). */
export class PaymentDeclinedError extends AppError {
  constructor(reason: string) {
    super(reason, 402);
  }
}

/** Dado inconsistente no banco (tipo de produto sem classe de domínio): é falha interna, não erro do cliente. */
export class UnknownProductTypeError extends Error {
  constructor(type: string) {
    super(`Tipo de produto desconhecido: ${type}`);
    this.name = 'UnknownProductTypeError';
  }
}
