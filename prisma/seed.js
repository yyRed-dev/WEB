#!/usr/bin/env node
// Dados iniciais OBRIGATÓRIOS: categorias e tipos de atividade.
// Pode rodar várias vezes: usa upsert (cria se não existe, não duplica).
//   npm run db:seed     (também roda sozinho após `prisma migrate reset`)
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');

const CATEGORIAS = [
  { nome: 'Ensino', descricao: 'Monitorias, cursos, minicursos e outras atividades ligadas ao ensino.' },
  { nome: 'Pesquisa', descricao: 'Iniciação científica, publicações, apresentações de trabalhos e grupos de pesquisa.' },
  { nome: 'Extensão', descricao: 'Projetos de extensão, eventos, voluntariado e ações com a comunidade.' },
];

// Formato da atividade. Usado nos filtros do catálogo (Eventos, Minicursos, Workshops...).
const TIPOS = [
  'Evento', 'Minicurso', 'Workshop', 'Curso', 'Estágio', 'Monitoria',
  'Projeto', 'Voluntariado', 'Publicação', 'Visita técnica', 'Outro',
];

async function semearBase(prisma) {
  for (const c of CATEGORIAS) {
    await prisma.categoria.upsert({ where: { nome: c.nome }, update: {}, create: c });
  }
  for (const nome of TIPOS) {
    await prisma.tipoAtividade.upsert({ where: { nome }, update: {}, create: { nome } });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  semearBase(prisma)
    .then(() => console.log(`Dados iniciais prontos: ${CATEGORIAS.length} categorias e ${TIPOS.length} tipos de atividade.`))
    .catch((erro) => {
      console.error('Falha ao inserir os dados iniciais:', erro.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { semearBase, CATEGORIAS, TIPOS };
