# Projeto Legacy - E-commerce Monolítico 

Este projeto simula um backend de e-commerce com código "legado". Ele funciona, mas possui graves problemas de design que dificultam a manutenção e expansão.

## Estrutura de Diretórios

* `src/controllers/OrderController.ts`: **O Problema.** Contém toda a lógica de negócio centralizada (validação, frete, pagamento, banco, notificação).
* `src/lib/logger.ts`: Utilitário de log (Winston - procure mais sobre ele, é muito util em projetos reais).
* `src/lib/mail.ts`: Configuração do Nodemailer (utilizando Ethereal para testes).
* `src/app.ts` & `src/server.ts`: Configuração do Express e inicialização do servidor.
* `prisma/`: Configuração do banco de dados SQLite e script de seed.
* `prisma/seed.ts`: Popula o banco com dados iniciais.

## Instalação e Configuração

Siga os passos abaixo para preparar o ambiente:

1.  **Instale as dependências:**
    ```bash
    npm install
    ```

2.  **Crie o banco de dados (SQLite) e as tabelas:**
    ```bash
    npm run prisma:migrate
    ```

3.  **Popule o banco com dados de teste (Livro Físico e E-book):**
    ```bash
    npm run prisma:seed
    ```

## Execução

Para rodar a API em modo de desenvolvimento (reinicia ao salvar arquivos):

```bash
npm run dev
```

O servidor iniciará em `http://localhost:3000`.
*Nota: A primeira execução pode demorar alguns segundos para gerar as credenciais de teste do Ethereal Mail.*

## Como Testar

Utilize o **cURL** (terminal) ou ferramentas como **Postman/Insomnia** para enviar requisições POST.

Você pode utilizar o gitbash para executar os comandos abaixo usando o cURL, ele parece estar funcionando muito bem (mas claro que o melhor seria utilizar Linux).


### Cenário 1: Compra de Livro Físico (Com Frete)
O sistema deve calcular R$ 10,00 de frete.

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "customer": "abacaxi123@ethereal.email",
  "items": [{ "productId": 1, "quantity": 1 }],
  "paymentMethod": "credit_card",
  "paymentDetails": { "cardNumber": "1234567812345678", "cvv": "123" }
}'
```

### Cenário 2: Compra de E-book (Digital)
Produto digital (ID 2). Observe como o código atual trata isso (gera frete incorreto ou lógica misturada).

```bash
curl -X POST http://localhost:3000/orders \
-H "Content-Type: application/json" \
-d '{
  "customer": "abacate123@ethereal.email",
  "items": [{ "productId": 2, "quantity": 1 }],
  "paymentMethod": "credit_card",
  "paymentDetails": { "cardNumber": "1234567812345678", "cvv": "123" }
}'
```

---

## Sugestões de Melhoria

O objetivo deste trabalho é refatorar o `OrderController` aplicando os princípios SOLID. Abaixo estão as sugestões do que deve ser feito:

### 1. Separação de Responsabilidades (SRP) e Camadas
O Controller atual mistura regras de negócio com detalhes de infraestrutura.
* **Infraestrutura de Email:** O `nodemailer` é uma ferramenta externa e não deve estar no meio da regra de negócio.
    * *Sugestão:* Crie uma interface `IMailProvider` e uma implementação `EtherealMailProvider`.
    * *Sugestão:* Crie um `NotificationService` (Business) que monta a mensagem e chama o Provider.
* **Persistência:** O Service não deve conhecer o Prisma diretamente.
    * *Sugestão:* Crie uma interface `IOrderRepository` (Contrato) e uma implementação `PrismaOrderRepository`.

### 2. Extensibilidade de Pagamentos (OCP)
O sistema deve estar "Aberto para extensão, mas fechado para modificação".
* **Problema:** Adicionar "Pix" hoje exige mudar `if/else` dentro do código principal.
* **Solução:** Crie uma interface `IPaymentMethod` com um método `process()`. Crie classes concretas (`CreditCardPayment`, `PixPayment`) que implementam essa interface.

### 3. Hierarquia de Produtos (LSP)
Este é o ponto mais crítico da lógica de negócio.
* **Problema:** O código verifica `if (product.type === 'physical')` para cobrar frete.
* **Solução:**
    1. Crie uma classe abstrata ou interface `Product` com um método `calculateFreight()`.
    2. Crie classes concretas: `PhysicalProduct` (cobra frete) e `DigitalProduct` (frete zero).
    3. **Importante:** Crie uma Factory ou Mapper para converter o JSON do banco nessas classes ricas antes de processar o pedido.

---

## Árvore de Arquivos Sugerida (Pós-Refatoração)

> **Nota:** Esta estrutura é apenas uma sugestão didática. Você tem liberdade para organizar as pastas de outra forma, desde que os princípios SOLID sejam respeitados.


```text
src/
├── controllers/
│   └── OrderController.ts        # (HTTP) Recebe request, chama OrderService, devolve response.
├── domain/                       # (Core) Regras de Negócio Puras
│   ├── IProduct.ts               # Interface do Produto
│   ├── PhysicalProduct.ts        # Regra de frete físico
│   ├── DigitalProduct.ts         # Regra de frete digital
│   └── ProductFactory.ts         # Cria o produto correto baseada no dado do banco (veja a dica abaixo).
├── services/                     # (Aplicação/Orquestração)
│   ├── OrderService.ts           # Fluxo do pedido (Valida -> Paga -> Salva -> Notifica)
│   └── NotificationService.ts    # Define O QUE enviar (Assunto, Corpo do email) - Utilize o provider de email.
├── providers/                    # (Infraestrutura) Implementações de ferramentas externas
│   ├── IMailProvider.ts          # Contrato (ex: sendMail)
│   └── EtherealMailProvider.ts   # Implementação usando NODEMAILER.
├── repositories/                 # (Camada de Dados)
│   ├── IOrderRepository.ts       # Interface (Abstração - Não sabe que o Prisma existe)
│   └── PrismaOrderRepository.ts  # Implementação Concreta (Usa o PrismaClient).
├── payments/                     # (Estratégias)
│   ├── IPaymentMethod.ts         # Contrato
│   ├── CreditCardPayment.ts
│   └── PixPayment.ts
├── lib/
│   └── logger.ts                 # Configuração do Winston
├── app.ts
└── server.ts
```

- *Dica Importante:* No `ProductFactory`, você pode ter um método `createProduct(data: any): Product` que verifica o tipo do produto e retorna a instância correta (`PhysicalProduct` ou `DigitalProduct`). Isso mantém o código do serviço limpo e focado na lógica de negócio. Utilize essa factory no `OrderService` para transformar os dados do banco em objetos antes de calcular o frete. Aqui você pode fazer algo como:

A factory pode ser algo assim:

```typescript
// ProductFactory.ts
import { Product } from './IProduct';
import { PhysicalProduct } from './PhysicalProduct';
import { DigitalProduct } from './DigitalProduct';
export class ProductFactory {
  static createProduct(data: any): Product {
    if (data.type === 'physical') {
      return new PhysicalProduct(data.id, data.name, data.price, data.weight, data.dimensions);
    } else if (data.type === 'digital') {
      return new DigitalProduct(data.id, data.name, data.price);
    }
    throw new Error('Unknown product type');
  }
}
```

E aqui vai um exemplo de uso dentro do OrderService:

```typescript
const product = ProductFactory.createProduct(productDataFromDB);
const freight = product.calculateFreight();
```

O que descrevo aqui são sugestões para quem não tem idéia por onde começar. Mas se você ja tem uma idéia, sinta-se livre para implementa-la.



