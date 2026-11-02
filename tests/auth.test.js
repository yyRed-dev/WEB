// Login de teste (sem token) e cadastro de aluno.
const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const h = require('./helpers');
const config = require('../src/config/env');
const limiteLogin = require('../src/services/limiteLogin');

before(h.iniciar);
after(h.encerrar);
beforeEach(() => limiteLogin.limparTudo());

const login = (matricula, senha = h.SENHA) => h.requisicao('POST', '/auth/login', { corpo: { matricula, senha } });

let contador = 0;
const novoAluno = (extras = {}) => ({
  nome: 'Aluna Nova da Silva',
  matricula: `NOVO${Date.now().toString().slice(-6)}${++contador}`,
  email: `nova${Date.now()}${contador}@exemplo.edu`,
  senha: 'SenhaNova1',
  cursoId: h.ids.curso.A,
  ...extras,
});

describe('POST /api/auth/login', () => {
  it('aluno: devolve nome, matrícula, perfil e curso (sem senha e sem token)', async () => {
    const r = await login('ALUA1');
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body), ['usuario']);
    assert.equal(r.body.usuario.nome, 'Aluno A Um');
    assert.equal(r.body.usuario.matricula, 'ALUA1');
    assert.equal(r.body.usuario.perfil, 'ALUNO');
    assert.equal(r.body.usuario.curso.nome, 'Curso Teste A');
    assert.ok(!JSON.stringify(r.body).toLowerCase().includes('senha'));
  });

  it('coordenador: perfil COORDENADOR', async () => {
    const r = await login('cooa'); // matrícula em minúsculas também funciona
    assert.equal(r.status, 200);
    assert.equal(r.body.usuario.perfil, 'COORDENADOR');
  });

  it('senha errada e matrícula inexistente dão a MESMA resposta 401', async () => {
    const r1 = await login('ALUA1', 'SenhaErrada9');
    const r2 = await login('NAOEXISTE1', 'SenhaErrada9');
    assert.equal(r1.status, 401);
    assert.deepEqual(r1.body, r2.body);
    assert.equal(r1.body.erro.codigo, 'CREDENCIAIS_INVALIDAS');
  });

  it('conta desativada ou sem senha cadastrada não entra (mesma resposta)', async () => {
    assert.equal((await login('INATIVO1')).body.erro.codigo, 'CREDENCIAIS_INVALIDAS');
    await h.prisma.usuario.create({ data: { matricula: 'SEMSENHA1', nome: 'Sem Senha', cursoId: h.ids.curso.A } });
    assert.equal((await login('SEMSENHA1', 'qualquer1')).status, 401);
  });

  it('exige matrícula e senha (400) e resiste a SQL Injection (401)', async () => {
    assert.equal((await h.requisicao('POST', '/auth/login', { corpo: { matricula: 'ALUA1' } })).status, 400);
    assert.equal((await h.requisicao('POST', '/auth/login', { corpo: { senha: 'x' } })).status, 400);
    assert.equal((await login("' OR '1'='1' -- ", "' OR '1'='1")).status, 401);
  });

  it('bloqueia (429 + Retry-After) após 5 falhas, mesmo com a senha certa', async () => {
    for (let i = 0; i < 5; i += 1) assert.equal((await login('ALUA2', 'Errada123')).status, 401);
    const r = await login('ALUA2');
    assert.equal(r.status, 429);
    assert.equal(r.body.erro.codigo, 'MUITAS_TENTATIVAS');
    assert.ok(Number(r.headers.get('retry-after')) > 0);
  });

  it('depois do login, a matrícula devolvida identifica o usuário no X-Matricula', async () => {
    const r = await login('COOB');
    const me = await h.api('GET', '/usuarios/me', { como: r.body.usuario.matricula });
    assert.equal(me.body.usuario.perfil, 'COORDENADOR');
  });

  it('login funciona mesmo com um X-Matricula antigo (de conta apagada) guardado no navegador', async () => {
    const r = await h.requisicao('POST', '/auth/login', {
      corpo: { matricula: 'ALUA1', senha: h.SENHA }, headers: { 'X-Matricula': 'CONTAAPAGADA1' },
    });
    assert.equal(r.status, 200);
  });
});

describe('POST /api/auth/cadastro', () => {
  it('cria um ALUNO com senha em bcrypt e já consegue fazer login', async () => {
    const dados = novoAluno({ email: '  Nova.Aluna@Exemplo.EDU ' });
    const r = await h.requisicao('POST', '/auth/cadastro', { corpo: dados });
    assert.equal(r.status, 201);
    assert.equal(r.body.usuario.perfil, 'ALUNO');
    assert.equal(r.body.usuario.email, 'nova.aluna@exemplo.edu');
    assert.equal(r.body.usuario.curso.id, h.ids.curso.A);
    assert.ok(!JSON.stringify(r.body).toLowerCase().includes('senha'));

    const gravado = await h.prisma.usuario.findUnique({ where: { matricula: dados.matricula } });
    assert.notEqual(gravado.senhaHash, dados.senha);
    assert.equal(await bcrypt.compare(dados.senha, gravado.senhaHash), true);
    assert.equal((await login(dados.matricula, dados.senha)).status, 200);
  });

  for (const perfil of ['COORDENADOR', 'coordenador', 'ADMINISTRADOR']) {
    it(`não deixa escolher o perfil ${perfil} (403) e não cria a conta`, async () => {
      const dados = novoAluno({ perfil });
      const r = await h.requisicao('POST', '/auth/cadastro', { corpo: dados });
      assert.equal(r.status, 403);
      assert.equal(await h.prisma.usuario.count({ where: { matricula: dados.matricula } }), 0);
    });
  }

  it('matrícula ou e-mail repetidos: 409', async () => {
    const r1 = await h.requisicao('POST', '/auth/cadastro', { corpo: novoAluno({ matricula: 'alua1' }) });
    assert.equal(r1.status, 409);
    assert.equal(r1.body.erro.codigo, 'MATRICULA_JA_CADASTRADA');
    const dados = novoAluno();
    await h.requisicao('POST', '/auth/cadastro', { corpo: dados });
    const r2 = await h.requisicao('POST', '/auth/cadastro', { corpo: novoAluno({ email: dados.email.toUpperCase() }) });
    assert.equal(r2.body.erro.codigo, 'EMAIL_JA_CADASTRADO');
  });

  it('valida os campos e a mensagem diz o que corrigir', async () => {
    const r = await h.requisicao('POST', '/auth/cadastro', {
      corpo: { nome: 'X', matricula: 'a b', email: 'nao-e-email', senha: '123', cursoId: 'abc' },
    });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.erro.detalhes.campos).sort(), ['cursoId', 'email', 'matricula', 'nome', 'senha']);
    assert.match(r.body.erro.mensagem, /senha/i);
  });

  it('senha precisa de 8+ caracteres com letra e número; curso precisa existir e estar ativo', async () => {
    for (const senha of ['abc12', 'somenteletras', '1234567890']) {
      assert.equal((await h.requisicao('POST', '/auth/cadastro', { corpo: novoAluno({ senha }) })).status, 400, senha);
    }
    assert.equal((await h.requisicao('POST', '/auth/cadastro', { corpo: novoAluno({ cursoId: h.ids.curso.inativo }) })).status, 400);
    assert.equal((await h.requisicao('POST', '/auth/cadastro', { corpo: novoAluno({ cursoId: 999999 }) })).status, 400);
  });

  it('respeita CADASTRO_PUBLICO_HABILITADO=false', async () => {
    config.auth.cadastroPublico = false;
    try {
      assert.equal((await h.requisicao('POST', '/auth/cadastro', { corpo: novoAluno() })).status, 403);
    } finally {
      config.auth.cadastroPublico = true;
    }
  });
});
