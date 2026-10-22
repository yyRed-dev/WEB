// Identificação provisória (cabeçalho X-Matricula), autorização e respostas gerais.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const h = require('./helpers');

before(h.iniciar);
after(h.encerrar);

describe('Identificação pelo cabeçalho X-Matricula', () => {
  it('sem cabeçalho, rota que exige usuário responde 401', async () => {
    const r = await h.api('GET', '/usuarios/me');
    assert.equal(r.status, 401);
    assert.equal(r.body.erro.codigo, 'IDENTIFICACAO_NECESSARIA');
  });

  it('com matrícula válida devolve o usuário e o curso (números, não texto)', async () => {
    const r = await h.api('GET', '/usuarios/me', { como: 'alua1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.usuario.matricula, 'ALUA1');
    assert.equal(r.body.usuario.perfil, 'ALUNO');
    assert.deepEqual(r.body.usuario.curso, { id: h.ids.curso.A, nome: 'Curso Teste A', cargaHorariaMinima: 200 });
  });

  it('matrícula inexistente: 401', async () => {
    const r = await h.api('GET', '/usuarios/me', { como: 'NAOEXISTE9' });
    assert.equal(r.status, 401);
    assert.equal(r.body.erro.codigo, 'USUARIO_NAO_ENCONTRADO');
  });

  it('usuário desativado: 401', async () => {
    assert.equal((await h.api('GET', '/usuarios/me', { como: 'INATIVO1' })).status, 401);
  });

  it('formato inválido de matrícula: 401', async () => {
    const r = await h.api('GET', '/usuarios/me', { como: "' OR 1=1 --" });
    assert.equal(r.status, 401);
    assert.equal(r.body.erro.codigo, 'IDENTIFICACAO_INVALIDA');
  });

  it('rotas públicas funcionam sem identificação', async () => {
    assert.equal((await h.api('GET', '/categorias')).status, 200);
    assert.equal((await h.api('GET', '/atividades')).status, 200);
  });

  it('o perfil vem do banco: mudar no banco muda o acesso na hora', async () => {
    assert.equal((await h.api('POST', '/atividades', { corpo: h.atividadeValida(), como: 'ALUA2' })).status, 403);
    await h.prisma.usuario.update({ where: { matricula: 'ALUA2' }, data: { perfil: 'ORGANIZADOR' } });
    assert.equal((await h.api('POST', '/atividades', { corpo: h.atividadeValida(), como: 'ALUA2' })).status, 201);
    await h.prisma.usuario.update({ where: { matricula: 'ALUA2' }, data: { perfil: 'ALUNO' } });
  });
});

describe('Configuração da identificação', () => {
  const env = (extras) => ({ ...process.env, ...extras });
  const raiz = path.join(__dirname, '..');
  const rodar = (codigo, extras) => spawnSync(process.execPath, ['-e', codigo], { cwd: raiz, env: env(extras), encoding: 'utf8' });

  it('recusa o modo cabeçalho em produção', () => {
    const r = rodar("require('./src/config/env')", { NODE_ENV: 'production', IDENTIFICACAO_MODO: 'cabecalho' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /não é permitido em produção/);
  });

  it('em produção, sem configuração, ninguém é identificado (modo nenhum)', () => {
    const r = rodar("console.log(require('./src/config/env').identificacao.modo)", { NODE_ENV: 'production', IDENTIFICACAO_MODO: '' });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), 'nenhum');
  });
});

describe('Respostas gerais', () => {
  it('GET /api/saude informa API e banco no ar', async () => {
    const r = await h.api('GET', '/saude');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { status: 'ok', banco: 'ok' });
  });

  it('rota inexistente: 404 no formato padrão', async () => {
    const r = await h.api('GET', '/nao-existe');
    assert.equal(r.status, 404);
    assert.equal(r.body.erro.codigo, 'ROTA_NAO_ENCONTRADA');
  });

  it('as rotas antigas de login/cadastro não existem mais', async () => {
    assert.equal((await h.api('POST', '/auth/login', { corpo: { matricula: 'ALUA1', senha: 'x' } })).status, 404);
    assert.equal((await h.api('POST', '/auth/cadastro', { corpo: {} })).status, 404);
  });

  it('JSON malformado: 400', async () => {
    const r = await h.api('POST', '/atividades', { corpoBruto: '{"titulo": ', como: 'ORG1' });
    assert.equal(r.status, 400);
    assert.equal(r.body.erro.codigo, 'JSON_INVALIDO');
  });
});
