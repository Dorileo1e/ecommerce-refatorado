import { Product } from './IProduct';

export class DigitalProduct implements Product {
  readonly type = 'digital' as const;

  constructor(
    readonly id: number,
    readonly name: string,
    readonly price: number,
  ) {}

  /** Produto digital não tem entrega: frete sempre zero (e nunca lança erro). */
  calculateFreight(): number {
    return 0;
  }
}
