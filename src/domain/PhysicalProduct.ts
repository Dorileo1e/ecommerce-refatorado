import { Product } from './IProduct';

export class PhysicalProduct implements Product {
  /** Frete fixo cobrado por linha de pedido (mesma regra do sistema legado). */
  static readonly FLAT_FREIGHT = 10;

  readonly type = 'physical' as const;

  constructor(
    readonly id: number,
    readonly name: string,
    readonly price: number,
  ) {}

  calculateFreight(): number {
    return PhysicalProduct.FLAT_FREIGHT;
  }
}
