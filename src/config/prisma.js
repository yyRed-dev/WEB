// Uma única instância do Prisma Client para toda a aplicação.
// (Criar várias instâncias abre conexões demais com o MySQL.)
//
// O Prisma usa consultas parametrizadas por padrão, o que impede SQL Injection.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;
