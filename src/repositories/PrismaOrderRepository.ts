import { PrismaClient } from '@prisma/client';
import { IOrderRepository, NewOrder } from './IOrderRepository';

export class PrismaOrderRepository implements IOrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(order: NewOrder): Promise<{ id: number }> {
    const saved = await this.prisma.order.create({
      data: {
        customer: order.customer,
        // O schema guarda os itens como string JSON (mesmo formato do sistema legado).
        items: JSON.stringify(order.items),
        total: order.total,
        status: order.status,
      },
    });

    return { id: saved.id };
  }
}
