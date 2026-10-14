import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { OrderController } from '../../src/controllers/OrderController';
import { OrderService } from '../../src/services/OrderService';
import { NotificationService } from '../../src/services/NotificationService';
import { CreditCardPayment } from '../../src/payments/CreditCardPayment';
import { PixPayment } from '../../src/payments/PixPayment';
import { IPaymentMethod } from '../../src/payments/IPaymentMethod';
import { IOrderRepository, NewOrder } from '../../src/repositories/IOrderRepository';
import { IProductRepository } from '../../src/repositories/IProductRepository';

/**
 * Teste HTTP de ponta a ponta EM MEMÓRIA: Express real + controller + OrderService reais,
 * com repositórios e e-mail falsos (sem banco e sem internet).
 * Monta a rota exatamente como o app.ts faz: app.post('/orders', controller.processOrder).
 */
const products = [
  { id: 1, name: 'O Programador Pragmático (Livro Físico)', type: 'physical', price: 100 },
  { id: 2, name: 'Clean Code (E-book)', type: 'digital', price: 50 },
];

const savedOrders: (NewOrder & { id: number })[] = [];
const productRepository: IProductRepository = { findById: async (id) => products.find((p) => p.id === id) ?? null };
const orderRepository: IOrderRepository = {
  create: async (order) => {
    const saved = { id: savedOrders.length + 1, ...order };
    savedOrders.push(saved);
    return { id: saved.id };
  },
};

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const paymentMethods = new Map<string, IPaymentMethod>([
  ['credit_card', new CreditCardPayment(logger)],
  ['pix', new PixPayment(logger)],
]);
const mail = { sendMail: async () => ({ previewUrl: 'https://ethereal.email/message/abc123' }) };
const service = new OrderService(productRepository, orderRepository, paymentMethods, new NotificationService(mail), logger);
const controller = new OrderController(service, logger);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post('/orders', controller.processOrder);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

async function post(body: unknown) {
  const response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const card = { cardNumber: '1234567812345678', cvv: '123' };

describe('POST /orders (HTTP em memória)', () => {
  it('Cenário 1: livro físico -> 200, orderId e link de preview; total salvo R$ 110', async () => {
    const { status, body } = await post({
      customer: 'abacaxi123@ethereal.email',
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'credit_card',
      paymentDetails: card,
    });

    expect(status).toBe(200);
    expect(body).toEqual({
      message: 'Pedido processado com sucesso',
      orderId: expect.any(Number),
      emailPreview: 'https://ethereal.email/message/abc123',
    });
    expect(savedOrders.at(-1)?.total).toBe(110);
  });

  it('Cenário 2: e-book -> 200; total salvo R$ 50 (frete zero)', async () => {
    const { status } = await post({
      customer: 'abacate123@ethereal.email',
      items: [{ productId: 2, quantity: 1 }],
      paymentMethod: 'credit_card',
      paymentDetails: card,
    });

    expect(status).toBe(200);
    expect(savedOrders.at(-1)?.total).toBe(50);
  });

  it('Pix é aceito sem alterar o fluxo principal', async () => {
    const { status } = await post({
      customer: 'pix@ethereal.email',
      items: [{ productId: 2, quantity: 1 }],
      paymentMethod: 'pix',
    });
    expect(status).toBe(200);
  });

  it('carrinho vazio -> 400 {"error":"Carrinho vazio"}', async () => {
    const { status, body } = await post({ customer: 'a@b.com', items: [], paymentMethod: 'credit_card', paymentDetails: card });
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Carrinho vazio' });
  });

  it('produto inexistente -> 400', async () => {
    const { status, body } = await post({
      customer: 'a@b.com',
      items: [{ productId: 999, quantity: 1 }],
      paymentMethod: 'credit_card',
      paymentDetails: card,
    });
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Produto 999 não encontrado' });
  });

  it('método de pagamento não suportado -> 400', async () => {
    const { status, body } = await post({
      customer: 'a@b.com',
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'bitcoin',
    });
    expect(status).toBe(400);
    expect(body).toEqual({ error: 'Método de pagamento não suportado' });
  });

  it('cartão recusado (CVV 000) -> 402 e nada é salvo', async () => {
    const before = savedOrders.length;

    const { status, body } = await post({
      customer: 'a@b.com',
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'credit_card',
      paymentDetails: { cardNumber: '1234567812345678', cvv: '000' },
    });

    expect(status).toBe(402);
    expect(body).toEqual({ error: 'Cartão recusado' });
    expect(savedOrders).toHaveLength(before);
  });

  it('cartão sem paymentDetails -> 400 (antes era 500)', async () => {
    const { status } = await post({
      customer: 'a@b.com',
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'credit_card',
    });
    expect(status).toBe(400);
  });

  it('quantidade negativa -> 400 e nada é salvo', async () => {
    const before = savedOrders.length;

    const { status } = await post({
      customer: 'a@b.com',
      items: [{ productId: 1, quantity: -3 }],
      paymentMethod: 'credit_card',
      paymentDetails: card,
    });

    expect(status).toBe(400);
    expect(savedOrders).toHaveLength(before);
  });
});
