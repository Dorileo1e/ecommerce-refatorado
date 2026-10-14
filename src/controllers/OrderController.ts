import { Request, Response } from 'express';
import { AppError } from '../domain/errors';
import { ILogger } from '../lib/ILogger';
import { OrderService } from '../services/OrderService';

/**
 * Camada HTTP: recebe a requisição, chama o OrderService e devolve a resposta.
 * Nenhuma regra de negócio, acesso a banco ou envio de e-mail acontece aqui.
 */
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly logger: ILogger,
  ) {}

  // Arrow function: mantém o `this` correto quando passado solto para o Express (app.post('/orders', controller.processOrder)).
  processOrder = async (req: Request, res: Response) => {
    try {
      const result = await this.orderService.createOrder(req.body ?? {});

      return res.json({
        message: 'Pedido processado com sucesso',
        orderId: result.orderId,
        emailPreview: result.emailPreview, // link do Ethereal para facilitar a visualização
      });
    } catch (error) {
      if (error instanceof AppError) {
        // Erro esperado (entrada inválida, produto inexistente, pagamento recusado...)
        this.logger.warn(`Pedido rejeitado (${error.statusCode}): ${error.message}`);
        return res.status(error.statusCode).json({ error: error.message });
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erro ao processar pedido: ${message}`);
      return res.status(500).json({ error: 'Erro interno' });
    }
  };
}
