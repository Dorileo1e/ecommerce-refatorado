import { ProductData } from '../domain/ProductData';

export interface IProductRepository {
  /** Devolve o dado cru do produto, ou null se não existir. */
  findById(id: number): Promise<ProductData | null>;
}
