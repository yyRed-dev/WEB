#!/usr/bin/env node
// Cria um usuário (ou atualiza perfil, curso e senha de um que já existe).
//
// O cadastro público (POST /api/auth/cadastro) só cria ALUNOS. Contas de
// COORDENADOR só são criadas por aqui: é preciso ter acesso ao servidor e ao .env.
//
//   npm run usuario:criar -- --matricula COO0001 --nome "Coordenação CC" --perfil COORDENADOR --curso-id 1
//   npm run usuario:criar -- --matricula 2023104567 --nome "Lucas Souza" --perfil ALUNO --curso-id 1 --email lucas@exemplo.edu
//
// A senha do login de teste é pedida no terminal (não aparece na tela).
// Em automação, use a variável de ambiente USUARIO_SENHA. Com --sem-senha a conta
// fica sem login próprio (ex.: futura integração com a Unifor).
require('dotenv').config({ quiet: true });
const readline = require('node:readline');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const config = require('../src/config/env');
const v = require('../src/utils/validacao');
const { LISTA_PERFIS } = require('../src/config/perfis');

function argumento(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function perguntarSenha(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let mudo = false;
    rl._writeToOutput = (texto) => rl.output.write(mudo ? '*' : texto);
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write('\n');
      resolve(resposta);
    });
    mudo = true;
  });
}

async function obterSenha() {
  if (process.argv.includes('--sem-senha')) return null;
  let senha = process.env.USUARIO_SENHA;
  if (!senha) {
    if (!process.stdin.isTTY) throw new Error('Informe a senha em USUARIO_SENHA ou use --sem-senha.');
    senha = await perguntarSenha('Senha (mín. 8 caracteres, com letra e número): ');
    if (senha !== (await perguntarSenha('Repita a senha: '))) throw new Error('As senhas não conferem.');
  }
  const { senha: valida } = v.validar({ senha: v.senhaNova(senha) });
  return bcrypt.hash(valida, config.auth.bcryptRounds);
}

async function principal(prisma) {
  const perfil = (argumento('perfil') || '').toUpperCase();
  if (!LISTA_PERFIS.includes(perfil)) throw new Error(`Informe --perfil: ${LISTA_PERFIS.join(' ou ')}.`);

  const dados = v.validar({
    matricula: v.matricula(argumento('matricula')),
    nome: v.texto(argumento('nome'), { min: 3, max: 150, nomeCampo: 'Nome' }),
    email: v.email(argumento('email')),
    // Aluno: curso dele. Coordenador: curso que coordena (sem curso ele não vê nenhuma submissão).
    cursoId: v.idPositivo(argumento('curso-id'), 'Curso (--curso-id)'),
  });
  const curso = await prisma.curso.findUnique({ where: { id: dados.cursoId } });
  if (!curso || !curso.ativo) throw new Error('Curso não encontrado ou inativo. Veja os cursos com: npm run db:studio');

  const senhaHash = await obterSenha();
  const usuario = await prisma.usuario.upsert({
    where: { matricula: dados.matricula },
    update: { perfil, cursoId: dados.cursoId, ativo: true, ...(senhaHash ? { senhaHash } : {}) },
    create: { matricula: dados.matricula, nome: dados.nome, email: dados.email, perfil, cursoId: dados.cursoId, senhaHash },
  });
  console.log(`Usuário ${usuario.matricula} pronto: ${usuario.perfil}, curso "${curso.nome}"${senhaHash ? ', com senha' : ', sem login próprio'}.`);
}

const prisma = new PrismaClient();
principal(prisma)
  .catch((erro) => {
    const campos = erro.detalhes?.campos ? ` ${JSON.stringify(erro.detalhes.campos)}` : '';
    console.error(`Não foi possível criar o usuário: ${erro.message}${campos}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
