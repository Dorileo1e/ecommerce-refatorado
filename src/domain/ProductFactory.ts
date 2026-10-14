import { Product } from './IProduct';
import { ProductData } from './ProductData';
import { PhysicalProduct } from './PhysicalProduct';
import { DigitalProduct } from './DigitalProduct';
import { UnknownProductTypeError } from './errors';

/**
 * Único lugar do sistema que olha o campo "type" do banco e converte o dado cru
 * em objeto de domínio. O restante do código só conhece a interface Product.
 */
export class ProductFactory {
  static createProduct(data: ProductData): Product {
    switch (data.type) {
      case 'physical':
        return new PhysicalProduct(data.id, data.name, data.price);
      case 'digital':
        return new DigitalProduct(data.id, data.name, data.price);
      default:
        throw new UnknownProductTypeError(data.type);
    }
  }
}
