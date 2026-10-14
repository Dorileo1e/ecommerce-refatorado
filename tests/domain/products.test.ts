import { describe, it, expect } from 'vitest';
import { Product } from '../../src/domain/IProduct';
import { PhysicalProduct } from '../../src/domain/PhysicalProduct';
import { DigitalProduct } from '../../src/domain/DigitalProduct';
import { ProductFactory } from '../../src/domain/ProductFactory';
import { UnknownProductTypeError } from '../../src/domain/errors';

describe('PhysicalProduct', () => {
  it('cobra frete de R$ 10,00', () => {
    const livro = new PhysicalProduct(1, 'Livro', 100);
    expect(livro.calculateFreight()).toBe(10);
  });
});

describe('DigitalProduct', () => {
  it('tem frete zero', () => {
    const ebook = new DigitalProduct(2, 'E-book', 50);
    expect(ebook.calculateFreight()).toBe(0);
  });
});

describe('ProductFactory', () => {
  it('cria PhysicalProduct a partir de um registro "physical"', () => {
    const product = ProductFactory.createProduct({ id: 1, name: 'Livro', type: 'physical', price: 100 });
    expect(product).toBeInstanceOf(PhysicalProduct);
    expect(product).toMatchObject({ id: 1, name: 'Livro', type: 'physical', price: 100 });
  });

  it('cria DigitalProduct a partir de um registro "digital"', () => {
    const product = ProductFactory.createProduct({ id: 2, name: 'E-book', type: 'digital', price: 50 });
    expect(product).toBeInstanceOf(DigitalProduct);
    expect(product).toMatchObject({ id: 2, name: 'E-book', type: 'digital', price: 50 });
  });

  it('lança erro para tipo de produto desconhecido (em vez de ignorar em silêncio)', () => {
    expect(() => ProductFactory.createProduct({ id: 3, name: 'Assinatura', type: 'subscription', price: 9 })).toThrow(
      UnknownProductTypeError,
    );
  });
});

describe('Contrato Product (LSP)', () => {
  it('qualquer implementação pode ser usada no lugar da outra, sempre devolvendo número >= 0 sem lançar erro', () => {
    const products: Product[] = [new PhysicalProduct(1, 'Livro', 100), new DigitalProduct(2, 'E-book', 50)];

    for (const product of products) {
      const freight = product.calculateFreight();
      expect(typeof freight).toBe('number');
      expect(freight).toBeGreaterThanOrEqual(0);
    }
  });
});
