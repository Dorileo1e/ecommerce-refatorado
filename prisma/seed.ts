import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Produto Físico
  await prisma.product.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'O Programador Pragmático (Livro Físico)',
      type: 'physical',
      price: 100.0,
    },
  })

  // Produto Digital (Para testar violação de LSP no futuro)
  await prisma.product.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: 'Clean Code (E-book)',
      type: 'digital',
      price: 50.0,
    },
  })

  console.log('Seed realizado com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })