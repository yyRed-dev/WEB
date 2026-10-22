#!/usr/bin/env node
// Cria um usuário (ou altera o perfil/curso de um que já existe).
//
// Enquanto a integração com a Unifor não existe, é assim que se cadastram
// administradores, coordenadores, organizadores e alunos para testes.
// Só quem tem acesso ao servidor (e ao .env) consegue rodar.
//
//   npm run usuario:criar -- --matricula ADM0001 --nome "Maria Souza" --perfil ADMINISTRADOR
//   npm run usuario:criar -- --matricula 2023104567 --nome "Lucas" --perfil ALUNO --curso-id 1
//   npm run usuario:criar -- --matricula COO0001 --nome "Coord. CC" --perfil COORDENADOR --curso-id 1
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const v = require('../src/utils/validacao');
const { LISTA_PERFIS, PERFIS } = require('../src/config/perfis');

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function principal(prisma) {
  const perfil = (argumento('perfil') || '').toUpperCase();
  if (!LISTA_PERFIS.includes(perfil)) throw new Error(`Informe --perfil: ${LISTA_PERFIS.join(', ')}.`);

  const dados = v.validar({
    matricula: v.matricula(argumento('matricula')),
    nome: v.texto(argumento('nome'), { min: 3, max: 150, nomeCampo: 'Nome' }),
    cursoId: v.idPositivo(argumento('curso-id'), 'Curso', { obrigatorio: perfil === PERFIS.ALUNO }),
  });
  if (dados.cursoId) {
    const curso = await prisma.curso.findUnique({ where: { id: dados.cursoId } });
    if (!curso || !curso.ativo) throw new Error('Curso não encontrado ou inativo.');
  }

  const usuario = await prisma.usuario.upsert({
    where: { matricula: dados.matricula },
    update: { perfil, cursoId: dados.cursoId, ativo: true },
    create: { matricula: dados.matricula, nome: dados.nome, perfil, cursoId: dados.cursoId },
  });
  console.log(`Usuário ${usuario.matricula} pronto: perfil ${usuario.perfil}${usuario.cursoId ? `, curso ${usuario.cursoId}` : ''}.`);
}

const prisma = new PrismaClient();
principal(prisma)
  .catch((erro) => {
    const campos = erro.detalhes?.campos ? ` ${JSON.stringify(erro.detalhes.campos)}` : '';
    console.error(`Não foi possível criar o usuário: ${erro.message}${campos}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
