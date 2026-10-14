export type PaymentResult =
  | { approved: true; transactionId: string }
  | { approved: false; reason: string };

/**
 * Contrato de uma forma de pagamento (OCP/ISP).
 * Cada implementação valida os próprios dados (`details` vem do corpo da
 * requisição e não é confiável) e lança ValidationError se estiverem inválidos.
 * Uma recusa do meio de pagamento NÃO é exceção: devolve { approved: false }.
 */
export interface IPaymentMethod {
  process(amount: number, details: unknown): Promise<PaymentResult>;
}
