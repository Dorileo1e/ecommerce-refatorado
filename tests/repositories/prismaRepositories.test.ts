import { describe, it, expect, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaOrderRepository } from '../../src/repositories/PrismaOrderRepository';
import { PrismaProductRepository } from '../../src/repositories/PrismaProductRepository';

/**
 * Estes testes usam um PrismaClient FALSO: verificam o que os repositórios enviam
 * ao Prisma e o que devolvem. Não exercitam o SQLite real (isso é validado rodando
 * `npm run prisma:migrate`, `npm run prisma:seed` e os cenários de curl).
 */
function fakePrisma(overrides: { order?: unknown; product?: unknown }) {
  return overrides as unknown as PrismaClient;
}

describe('PrismaOrderRepository', () => {
  it('grava customer, items (JSON), total e status no formato do schema e devolve o id', async () => {
    const create = vi.fn().mockResolvedValue({ id: 42, customer: 'a@b.com', items: '[]', total: 110, status: 'confirmed' });
    const repository = new PrismaOrderRepository(fakePrisma({ order: { create } }));

    const items = [{ id: 1, name: 'Livro', type: 'physical' as const, price: 100, quantity: 1 }];
    const result = await repository.create({ customer: 'a@b.com', items, total: 110, status: 'confirmed' });

    expect(result).toEqual({ id: 42 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: { customer: 'a@b.com', items: JSON.stringify(items), total: 110, status: 'confirmed' },
    });
  });

  it('o JSON dos itens mantém o formato legado: id, name, type, price, quantity (nessa ordem)', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1 });
    const repository = new PrismaOrderRepository(fakePrisma({ order: { create } }));

    await repository.create({
      customer: 'a@b.com',
      items: [{ id: 2, name: 'E-book', type: 'digital', price: 50, quantity: 3 }],
      total: 150,
      status: 'confirmed',
    });

    const persisted = create.mock.calls[0][0].data.items as string;
    expect(persisted).toBe('[{"id":2,"name":"E-book","type":"digital","price":50,"quantity":3}]');
  });

  it('propaga o erro do banco (não engole falhas de persistência)', async () => {
    const create = vi.fn().mockRejectedValue(new Error('db fora do ar'));
    const repository = new PrismaOrderRepository(fakePrisma({ order: { create } }));

    await expect(repository.create({ customer: 'a@b.com', items: [], total: 0, status: 'confirmed' })).rejects.toThrow(
      'db fora do ar',
    );
  });
});

describe('PrismaProductRepository', () => {
  it('busca o produto pelo id', async () => {
    const row = { id: 1, name: 'Livro', type: 'physical', price: 100 };
    const findUnique = vi.fn().mockResolvedValue(row);
    const repository = new PrismaProductRepository(fakePrisma({ product: { findUnique } }));

    await expect(repository.findById(1)).resolves.toEqual(row);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('devolve null quando o produto não existe', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const repository = new PrismaProductRepository(fakePrisma({ product: { findUnique } }));

    await expect(repository.findById(999)).resolves.toBeNull();
  });
});
