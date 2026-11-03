// Identificação pelo cabeçalho X-Matricula, autorização e respostas gerais.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const h = require('./helpers');
const config = require('../src/config/env');

before(h.iniciar);
after(h.encerrar);

describe('Identificação pelo cabeçalho X-Matricula', () => {
  it('sem cabeçalho, rota que exige login responde 401', async () => {
    const r = await h.api('GET', '/usuarios/me');
    assert.equal(r.status, 401);
    assert.equal(r.body.erro.codigo, 'IDENTIFICACAO_NECESSARIA');
  });

  it('com matrícula válida devolve o usuário e o curso (números, não texto), sem senha', async () => {
    const r = await h.api('GET', '/usuarios/me', { como: 'alua1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.usuario.matricula, 'ALUA1');
    assert.equal(r.body.usuario.perfil, 'ALUNO');
    assert.deepEqual(r.body.usuario.curso, { id: h.ids.curso.A, nome: 'Curso Teste A', cargaHorariaMinima: 200 });
    assert.ok(!JSON.stringify(r.body).toLowerCase().includes('senha'));
  });

  it('matrícula inexistente, conta desativada ou formato inválido: 401', async () => {
    assert.equal((await h.api('GET', '/usuarios/me', { como: 'NAOEXISTE9' })).body.erro.codigo, 'USUARIO_NAO_ENCONTRADO');
    assert.equal((await h.api('GET', '/usuarios/me', { como: 'INATIVO1' })).status, 401);
    assert.equal((await h.api('GET', '/usuarios/me', { como: "' OR 1=1 --" })).body.erro.codigo, 'IDENTIFICACAO_INVALIDA');
  });

  it('conta desativada perde o acesso na hora', async () => {
    assert.equal((await h.api('GET', '/usuarios/me', { como: 'ALUB1' })).status, 200);
    await h.prisma.usuario.update({ where: { matricula: 'ALUB1' }, data: { ativo: false } });
    try {
      assert.equal((await h.api('GET', '/usuarios/me', { como: 'ALUB1' })).status, 401);
    } finally {
      await h.prisma.usuario.update({ where: { matricula: 'ALUB1' }, data: { ativo: true } });
    }
  });

  it('o perfil vem do banco: mudar no banco muda o acesso na hora', async () => {
    assert.equal((await h.api('POST', '/atividades', { corpo: h.atividadeValida(), como: 'ALUA2' })).status, 403);
    await h.prisma.usuario.update({ where: { matricula: 'ALUA2' }, data: { perfil: 'COORDENADOR' } });
    try {
      assert.equal((await h.api('POST', '/atividades', { corpo: h.atividadeValida(), como: 'ALUA2' })).status, 201);
    } finally {
      await h.prisma.usuario.update({ where: { matricula: 'ALUA2' }, data: { perfil: 'ALUNO' } });
    }
  });

  it('rotas públicas funcionam sem identificação', async () => {
    assert.equal((await h.api('GET', '/categorias')).status, 200);
    assert.equal((await h.api('GET', '/atividades')).status, 200);
  });

  it('modo nenhum: ninguém é identificado', async () => {
    config.identificacao.modo = 'nenhum';
    try {
      assert.equal((await h.api('GET', '/usuarios/me', { como: 'ALUA1' })).status, 401);
    } finally {
      config.identificacao.modo = 'cabecalho';
    }
  });
});

describe('Configuração', () => {
  const raiz = path.join(__dirname, '..');
  const rodar = (codigo, extras) => spawnSync(process.execPath, ['-e', codigo], {
    cwd: raiz, env: { ...process.env, ...extras }, encoding: 'utf8',
  });

  it('o modo padrão é cabecalho; um modo desconhecido (ex.: token) é recusado', () => {
    const padrao = rodar("console.log(require('./src/config/env').identificacao.modo)", { IDENTIFICACAO_MODO: '' });
    assert.equal(padrao.stdout.trim(), 'cabecalho');
    const token = rodar("require('./src/config/env')", { IDENTIFICACAO_MODO: 'token' });
    assert.notEqual(token.status, 0);
    assert.match(token.stderr, /IDENTIFICACAO_MODO inválido/);
  });

  it('em produção exige ARQUIVOS_SEGREDO (assinatura dos links dos certificados)', () => {
    const sem = rodar("require('./src/config/env')", { NODE_ENV: 'production', ARQUIVOS_SEGREDO: '', BCRYPT_ROUNDS: '12' });
    assert.notEqual(sem.status, 0);
    assert.match(sem.stderr, /ARQUIVOS_SEGREDO/);
    const com = rodar("require('./src/config/env')", { NODE_ENV: 'production', ARQUIVOS_SEGREDO: 'x'.repeat(40), BCRYPT_ROUNDS: '12' });
    assert.equal(com.status, 0, com.stderr);
  });
});

describe('Respostas gerais', () => {
  it('GET /api/saude informa API e banco no ar', async () => {
    const r = await h.api('GET', '/saude');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { status: 'ok', banco: 'ok' });
  });

  it('rota inexistente: 404 no formato padrão; não existe rota de logout', async () => {
    const r = await h.api('GET', '/nao-existe');
    assert.equal(r.status, 404);
    assert.equal(r.body.erro.codigo, 'ROTA_NAO_ENCONTRADA');
    assert.equal((await h.api('POST', '/auth/logout', { como: 'ALUA1' })).status, 404);
  });

  it('JSON malformado: 400', async () => {
    const r = await h.api('POST', '/atividades', { corpoBruto: '{"titulo": ', como: 'COOA' });
    assert.equal(r.status, 400);
    assert.equal(r.body.erro.codigo, 'JSON_INVALIDO');
  });

  it('erro de validação traz a mensagem de cada campo (o front mostra só a mensagem)', async () => {
    const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ titulo: 'x' }), como: 'COOA' });
    assert.equal(r.status, 400);
    assert.match(r.body.erro.mensagem, /Título deve ter pelo menos 3 caracteres/);
    assert.ok(r.body.erro.detalhes.campos.titulo);
  });
});
