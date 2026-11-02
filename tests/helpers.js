// Preparação comum dos testes de integração (API + Prisma + MySQL).
// Rode com `npm test`: ele aponta o Prisma para DATABASE_URL_TEST, recria o
// banco de testes e só então executa estes arquivos.
require('dotenv').config({ quiet: true });
const os = require('node:os');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.IDENTIFICACAO_MODO = process.env.IDENTIFICACAO_MODO || 'cabecalho';
process.env.BCRYPT_ROUNDS = '4';
process.env.ARQUIVO_TAMANHO_MAXIMO_MB = '1';
process.env.UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(os.tmpdir(), `portal-testes-uploads-${process.pid}`);

function garantirBancoDeTeste() {
  let nome = '';
  try {
    nome = new URL(process.env.DATABASE_URL).pathname.replace(/^\//, '');
  } catch {
    /* tratado abaixo */
  }
  if (!nome.endsWith('_test')) {
    throw new Error('Os testes apagam o banco: rode com `npm test` (usa DATABASE_URL_TEST, terminado em _test).');
  }
}
garantirBancoDeTeste();

const fs = require('node:fs');
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');
const app = require('../src/app');
const limiteLogin = require('../src/services/limiteLogin');
const { semearBase } = require('../prisma/seed');

const SENHA = 'Senha1234'; // senha de todas as contas de teste
let servidor;
let baseUrl;
const ids = { categoria: {}, tipo: {}, curso: {}, usuario: {} };

/** Apaga tudo, na ordem que as chaves estrangeiras permitem. */
async function limparBanco() {
  await prisma.avaliacao.deleteMany();
  await prisma.comprovante.deleteMany();
  await prisma.submissao.deleteMany();
  await prisma.atividadeCurso.deleteMany();
  await prisma.atividade.deleteMany();
  await prisma.metaCategoriaCurso.deleteMany();
  await prisma.usuario.deleteMany();
  await prisma.curso.deleteMany();
  await prisma.tipoAtividade.deleteMany();
  await prisma.categoria.deleteMany();
}

/**
 * Cenário usado por todos os arquivos:
 *   Curso Teste A (200 h; metas Ensino 60, Pesquisa 50, Extensão 90)
 *   Curso Teste B (120 h; sem metas) · Curso Inativo
 *   Alunos: ALUA1, ALUA2 (curso A) · ALUB1 (curso B) · ALUSEM (sem curso) · INATIVO1 (desativado)
 *   Coordenadores: COOA, COOA2 (curso A) · COOB (curso B) · COOSEM (sem curso)
 *   Todas as contas usam a senha SENHA.
 */
async function prepararCenario() {
  await limparBanco();
  limiteLogin.limparTudo();
  await semearBase(prisma);

  for (const c of await prisma.categoria.findMany()) ids.categoria[c.nome] = c.id;
  for (const t of await prisma.tipoAtividade.findMany()) ids.tipo[t.nome] = t.id;

  const cursoA = await prisma.curso.create({ data: { nome: 'Curso Teste A', cargaHorariaMinima: 200 } });
  const cursoB = await prisma.curso.create({ data: { nome: 'Curso Teste B', cargaHorariaMinima: 120 } });
  const inativo = await prisma.curso.create({ data: { nome: 'Curso Inativo', cargaHorariaMinima: 100, ativo: false } });
  Object.assign(ids.curso, { A: cursoA.id, B: cursoB.id, inativo: inativo.id });

  for (const [categoria, horasMeta] of [['Ensino', 60], ['Pesquisa', 50], ['Extensão', 90]]) {
    await prisma.metaCategoriaCurso.create({ data: { cursoId: cursoA.id, categoriaId: ids.categoria[categoria], horasMeta } });
  }

  const senhaHash = await bcrypt.hash(SENHA, 4);
  const usuarios = [
    ['ALUA1', 'Aluno A Um', 'ALUNO', cursoA.id],
    ['ALUA2', 'Aluno A Dois', 'ALUNO', cursoA.id],
    ['ALUB1', 'Aluno B Um', 'ALUNO', cursoB.id],
    ['ALUSEM', 'Aluno Sem Curso', 'ALUNO', null],
    ['COOA', 'Coordenação A', 'COORDENADOR', cursoA.id],
    ['COOA2', 'Coordenação A Dois', 'COORDENADOR', cursoA.id],
    ['COOB', 'Coordenação B', 'COORDENADOR', cursoB.id],
    ['COOSEM', 'Coordenação Sem Curso', 'COORDENADOR', null],
  ];
  for (const [matricula, nome, perfil, cursoId] of usuarios) {
    const u = await prisma.usuario.create({ data: { matricula, nome, perfil, cursoId, senhaHash } });
    ids.usuario[matricula] = u.id;
  }
  const inativoU = await prisma.usuario.create({
    data: { matricula: 'INATIVO1', nome: 'Conta Inativa', cursoId: cursoA.id, ativo: false, senhaHash },
  });
  ids.usuario.INATIVO1 = inativoU.id;
}

async function iniciar() {
  fs.rmSync(process.env.UPLOADS_DIR, { recursive: true, force: true });
  await prepararCenario();
  servidor = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseUrl = `http://127.0.0.1:${servidor.address().port}/api`;
}

async function encerrar() {
  await new Promise((resolve) => servidor.close(resolve));
  await prisma.$disconnect();
}

async function requisicao(metodo, caminho, { corpo, corpoBruto, form, headers = {} } = {}) {
  const h = { ...headers };
  let body;
  if (form) body = form; // FormData: o fetch monta o multipart sozinho
  else if (corpoBruto !== undefined) { body = corpoBruto; h['Content-Type'] = 'application/json'; }
  else if (corpo !== undefined) { body = JSON.stringify(corpo); h['Content-Type'] = 'application/json'; }
  const resposta = await fetch(caminho.startsWith('http') ? caminho : baseUrl + caminho, { method: metodo, headers: h, body });
  const tipo = resposta.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await resposta.json() : Buffer.from(await resposta.arrayBuffer());
  return { status: resposta.status, body: dados, headers: resposta.headers };
}

/**
 * Chama a API. `como` = matrícula de quem faz a requisição (vai no cabeçalho X-Matricula).
 * Devolve { status, body, headers } (body = JSON ou Buffer para arquivos).
 */
async function api(metodo, caminho, { como, ...opcoes } = {}) {
  const headers = { ...(opcoes.headers || {}) };
  if (como) headers['X-Matricula'] = como;
  return requisicao(metodo, caminho, { ...opcoes, headers });
}

/** "AAAA-MM-DDTHH:mm" daqui a `dias` dias (lido pela API no fuso -03:00). */
function dataLocal(dias, hora = '14:00') {
  const d = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  return `${d.toISOString().slice(0, 10)}T${hora}`;
}

/** "AAAA-MM-DD" de `dias` dias atrás (para datas de certificados). */
function diaPassado(dias) {
  return new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
}

/** Corpo válido de atividade; `extras` sobrescreve campos. */
function atividadeValida(extras = {}) {
  return {
    titulo: 'Workshop de Desenvolvimento Web',
    descricao: 'Fundamentos do desenvolvimento web com projetos práticos.',
    categoriaId: ids.categoria['Extensão'],
    tipoId: ids.tipo.Workshop,
    modalidade: 'PRESENCIAL',
    dataInicio: dataLocal(10, '14:00'),
    dataFim: dataLocal(10, '18:00'),
    local: 'Auditório Central',
    cargaHoraria: 4,
    ...extras,
  };
}

/** Cria uma atividade pela API e devolve o JSON dela. */
async function criarAtividade(extras = {}, como = 'COOA') {
  const r = await api('POST', '/atividades', { corpo: atividadeValida(extras), como });
  if (r.status !== 201) throw new Error(`criação falhou: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.atividade;
}

/** Cria uma atividade direto no banco (permite datas no passado). */
async function criarAtividadeNoBanco(campos = {}) {
  return prisma.atividade.create({
    data: {
      titulo: 'Atividade direta',
      descricao: 'Criada direto pelo Prisma no teste.',
      categoriaId: ids.categoria.Ensino,
      tipoId: ids.tipo.Evento,
      modalidade: 'PRESENCIAL',
      local: 'Sala 1',
      dataInicio: new Date(Date.now() + 5 * 864e5),
      cargaHoraria: 2,
      organizadorId: ids.usuario.COOA,
      ...campos,
    },
  });
}

/** Cria uma submissão direto no banco (sem arquivo), para testes de progresso. */
async function criarSubmissao(matricula, categoria, campos = {}) {
  return prisma.submissao.create({
    data: {
      alunoId: ids.usuario[matricula],
      categoriaId: ids.categoria[categoria],
      titulo: 'Submissão de teste',
      dataInicio: new Date('2026-03-01'),
      horasSolicitadas: 10,
      ...campos,
    },
  });
}

// ----- Arquivos de exemplo para upload -----
let contadorArquivos = 0;
/** PDF mínimo e ÚNICO a cada chamada (conteúdo diferente = hash diferente). */
function pdf(texto = `certificado ${++contadorArquivos} ${Date.now()}`) {
  return Buffer.from(`%PDF-1.4\n% ${texto}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`);
}
function png() {
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from(`png ${++contadorArquivos}`)]);
}
function jpeg() {
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(`jpeg ${++contadorArquivos}`)]);
}

/** Monta o FormData do formulário "Enviar Certificado". */
function formularioCertificado(campos = {}, arquivo = { conteudo: pdf(), nome: 'certificado.pdf', tipo: 'application/pdf' }) {
  const form = new FormData();
  const padrao = { titulo: 'Curso de Git e GitHub', categoriaId: ids.categoria.Ensino, cargaHoraria: '10', ...campos };
  for (const [k, valor] of Object.entries(padrao)) if (valor !== undefined && valor !== null) form.append(k, String(valor));
  if (arquivo) form.append('arquivo', new Blob([arquivo.conteudo], { type: arquivo.tipo }), arquivo.nome);
  return form;
}

/** Envia um certificado como `como` e devolve a resposta. */
function enviarCertificado(como, campos, arquivo) {
  return api('POST', '/submissoes', { form: formularioCertificado(campos, arquivo), como });
}

module.exports = {
  prisma, ids, SENHA, iniciar, encerrar, api, requisicao, dataLocal, diaPassado,
  atividadeValida, criarAtividade, criarAtividadeNoBanco, criarSubmissao, prepararCenario,
  pdf, png, jpeg, formularioCertificado, enviarCertificado,
};
