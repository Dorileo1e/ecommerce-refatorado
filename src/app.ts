import express from 'express';
import { PrismaClient } from '@prisma/client';
import logger from './lib/logger';
import { OrderController } from './controllers/OrderController';
import { OrderService } from './services/OrderService';
import { NotificationService } from './services/NotificationService';
import { EtherealMailProvider } from './providers/EtherealMailProvider';
import { PrismaOrderRepository } from './repositories/PrismaOrderRepository';
import { PrismaProductRepository } from './repositories/PrismaProductRepository';
import { IPaymentMethod } from './payments/IPaymentMethod';
import { CreditCardPayment } from './payments/CreditCardPayment';
import { DebitCardPayment } from './payments/DebitCardPayment';
import { PixPayment } from './payments/PixPayment';

// ---- Composição das dependências (o ÚNICO lugar que conhece as implementações concretas) ----
const prisma = new PrismaClient();

// Para adicionar uma nova forma de pagamento: criar a classe e registrá-la aqui.
const paymentMethods = new Map<string, IPaymentMethod>([
  ['credit_card', new CreditCardPayment(logger)],
  ['debit_card', new DebitCardPayment(logger)],
  ['pix', new PixPayment(logger)],
]);

const orderService = new OrderService(
  new PrismaProductRepository(prisma),
  new PrismaOrderRepository(prisma),
  paymentMethods,
  new NotificationService(new EtherealMailProvider()),
  logger,
);

const orderController = new OrderController(orderService, logger);

// ---- Express ----
const app = express();
app.use(express.json());

app.post('/orders', orderController.processOrder);

export default app;
