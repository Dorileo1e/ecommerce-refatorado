export type ProductType = 'physical' | 'digital';

/**
 * Contrato de produto (LSP): qualquer implementação deve responder a
 * calculateFreight() com um número >= 0, sem lançar exceção, para que o
 * OrderService possa tratar todos os produtos de forma uniforme.
 */
export interface Product {
  readonly id: number;
  readonly name: string;
  readonly type: ProductType;
  readonly price: number;
  calculateFreight(): number;
}
