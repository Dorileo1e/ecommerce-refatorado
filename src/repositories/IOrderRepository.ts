import { ProductType } from '../domain/IProduct';

/** Cópia (snapshot) do produto no momento da compra, gravada junto com o pedido. */
export interface OrderItemSnapshot {
  id: number;
  name: string;
  type: ProductType;
  price: number;
  quantity: number;
}

export interface NewOrder {
  customer: string;
  items: OrderItemSnapshot[];
  total: number;
  status: 'confirmed';
}

export interface IOrderRepository {
  create(order: NewOrder): Promise<{ id: number }>;
}
