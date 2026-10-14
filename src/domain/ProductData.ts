/**
 * Dado "cru" de produto como vem da persistência.
 * É definido no domínio para que o domínio não dependa do Prisma
 * (o tipo gerado pelo Prisma é estruturalmente compatível com este).
 */
export interface ProductData {
  id: number;
  name: string;
  type: string;
  price: number;
}
