// Preparação comum dos testes de integração (API + Prisma + MySQL).
// Rode com `npm test`: ele aponta o Prisma para DATABASE_URL_TEST, recria o
// banco de testes e só então executa estes arquivos.
require('dotenv').config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.IDENTIFICACAO_MODO = 'cabecalho';

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

const prisma = require('../src/config/prisma');
const app = require('../src/app');
const { semearBase } = require('../prisma/seed');

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
 *   Usuários: ALUA1, ALUA2 (curso A) · ALUB1 (curso B) · ALUSEM (aluno sem curso)
 *             ORG1, ORG2 · COOA (coord. A) · COOB (coord. B) · ADM1 · INATIVO1
 */
async function prepararCenario() {
  await limparBanco();
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

  const usuarios = [
    ['ALUA1', 'Aluno A Um', 'ALUNO', cursoA.id],
    ['ALUA2', 'Aluno A Dois', 'ALUNO', cursoA.id],
    ['ALUB1', 'Aluno B Um', 'ALUNO', cursoB.id],
    ['ALUSEM', 'Aluno Sem Curso', 'ALUNO', null],
    ['ORG1', 'Organizador Um', 'ORGANIZADOR', null],
    ['ORG2', 'Organizador Dois', 'ORGANIZADOR', null],
    ['COOA', 'Coordenação A', 'COORDENADOR', cursoA.id],
    ['COOB', 'Coordenação B', 'COORDENADOR', cursoB.id],
    ['ADM1', 'Administração', 'ADMINISTRADOR', null],
  ];
  for (const [matricula, nome, perfil, cursoId] of usuarios) {
    const u = await prisma.usuario.create({ data: { matricula, nome, perfil, cursoId } });
    ids.usuario[matricula] = u.id;
  }
  const inativoU = await prisma.usuario.create({ data: { matricula: 'INATIVO1', nome: 'Conta Inativa', cursoId: cursoA.id, ativo: false } });
  ids.usuario.INATIVO1 = inativoU.id;
}

async function iniciar() {
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

/**
 * Chama a API. `como` = matrícula enviada no cabeçalho X-Matricula.
 * Devolve { status, body, headers }.
 */
async function api(metodo, caminho, { corpo, como, corpoBruto } = {}) {
  const headers = {};
  if (corpo !== undefined || corpoBruto !== undefined) headers['Content-Type'] = 'application/json';
  if (como) headers['X-Matricula'] = como;
  const resposta = await fetch(baseUrl + caminho, {
    method: metodo,
    headers,
    body: corpoBruto !== undefined ? corpoBruto : corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await resposta.text();
  return { status: resposta.status, body: texto ? JSON.parse(texto) : null, headers: resposta.headers };
}

/** "AAAA-MM-DDTHH:mm" daqui a `dias` dias (lido pela API no fuso -03:00). */
function dataLocal(dias, hora = '14:00') {
  const d = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
  return `${d.toISOString().slice(0, 10)}T${hora}`;
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
async function criarAtividade(extras = {}, como = 'ORG1') {
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
      organizadorId: ids.usuario.ORG1,
      ...campos,
    },
  });
}

/** Cria uma submissão direto no banco (as rotas de submissão são da próxima etapa). */
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

module.exports = {
  prisma, ids, iniciar, encerrar, api, dataLocal, atividadeValida, criarAtividade,
  criarAtividadeNoBanco, criarSubmissao, prepararCenario,
};
