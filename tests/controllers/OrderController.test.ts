import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { OrderController } from '../../src/controllers/OrderController';
import { OrderService } from '../../src/services/OrderService';
import { PaymentDeclinedError, ProductNotFoundError, ValidationError } from '../../src/domain/errors';

function setup(createOrder: ReturnType<typeof vi.fn>) {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const controller = new OrderController({ createOrder } as unknown as OrderService, logger);

  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const req = (body: unknown) => ({ body }) as Request;
  const asRes = () => res as unknown as Response;

  return { controller, logger, res, req, asRes };
}

describe('OrderController', () => {
  it('sucesso: repassa o corpo ao serviço e responde com message, orderId e emailPreview (status 200 padrão)', async () => {
    const createOrder = vi.fn().mockResolvedValue({ orderId: 5, emailPreview: 'https://ethereal.email/message/x' });
    const { controller, res, req, asRes } = setup(createOrder);
    const body = { customer: 'a@b.com', items: [] };

    await controller.processOrder(req(body), asRes());

    expect(createOrder).toHaveBeenCalledWith(body);
    expect(res.status).not.toHaveBeenCalled(); // contrato legado: 200, sem status explícito
    expect(res.json).toHaveBeenCalledWith({
      message: 'Pedido processado com sucesso',
      orderId: 5,
      emailPreview: 'https://ethereal.email/message/x',
    });
  });

  it('corpo ausente é tratado como objeto vazio', async () => {
    const createOrder = vi.fn().mockRejectedValue(new ValidationError('Carrinho vazio'));
    const { controller, req, asRes } = setup(createOrder);

    await controller.processOrder(req(undefined), asRes());

    expect(createOrder).toHaveBeenCalledWith({});
  });

  it.each([
    ['ValidationError', new ValidationError('Carrinho vazio'), 400, 'Carrinho vazio'],
    ['ProductNotFoundError', new ProductNotFoundError(9), 400, 'Produto 9 não encontrado'],
    ['PaymentDeclinedError', new PaymentDeclinedError('Cartão recusado'), 402, 'Cartão recusado'],
  ])('%s vira resposta %i com a mensagem do erro', async (_name, error, status, message) => {
    const { controller, res, req, asRes, logger } = setup(vi.fn().mockRejectedValue(error));

    await controller.processOrder(req({}), asRes());

    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ error: message });
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('erro inesperado vira 500 "Erro interno" (sem vazar a mensagem real) e é logado como erro', async () => {
    const { controller, res, req, asRes, logger } = setup(vi.fn().mockRejectedValue(new Error('senha do banco: 123')));

    await controller.processOrder(req({}), asRes());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Erro interno' });
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('senha do banco: 123'));
  });

  it('funciona quando o método é passado solto (como em app.post), sem perder o this', async () => {
    const createOrder = vi.fn().mockResolvedValue({ orderId: 1, emailPreview: null });
    const { controller, req, asRes, res } = setup(createOrder);

    const { processOrder } = controller; // desestruturar = método solto

    await processOrder(req({}), asRes());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ orderId: 1 }));
  });
});
