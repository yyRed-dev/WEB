// GET /api/progresso: horas concluídas, pendentes, restantes e por categoria.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(async () => {
  await h.iniciar();
  const aprovada = (horasSolicitadas, horasAprovadas) => ({
    status: 'APROVADA', horasSolicitadas, horasAprovadas, avaliadorId: h.ids.usuario.COOA, avaliadaEm: new Date(),
  });
  // ALUA1: 40 Ensino + 35 Pesquisa + 50 Extensão = 125 h aprovadas (igual ao dashboard das telas)
  await h.criarSubmissao('ALUA1', 'Ensino', aprovada(30, 30));
  await h.criarSubmissao('ALUA1', 'Ensino', aprovada(10, 10));
  await h.criarSubmissao('ALUA1', 'Pesquisa', aprovada(35, 35));
  await h.criarSubmissao('ALUA1', 'Extensão', aprovada(60, 50)); // pediu 60, aprovaram 50
  await h.criarSubmissao('ALUA1', 'Extensão', { horasSolicitadas: 8 }); // pendente
  await h.criarSubmissao('ALUA1', 'Ensino', {
    horasSolicitadas: 20, status: 'REJEITADA', permiteCorrecao: true, justificativa: 'Certificado sem carga horária.',
  });
  await h.criarSubmissao('ALUA1', 'Pesquisa', {
    horasSolicitadas: 5, status: 'REJEITADA', justificativa: 'Atividade fora do período do curso.',
  });
  // ALUA2: acima da carga mínima
  await h.criarSubmissao('ALUA2', 'Extensão', aprovada(250, 250));
});
after(h.encerrar);

const categoria = (corpo, nome) => corpo.porCategoria.find((c) => c.categoria.nome === nome);

describe('GET /api/progresso (aluno identificado)', () => {
  it('calcula concluídas, pendentes, restantes e percentual do próprio aluno', async () => {
    const r = await h.api('GET', '/progresso', { como: 'ALUA1' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.aluno, { id: h.ids.usuario.ALUA1, matricula: 'ALUA1', nome: 'Aluno A Um' });
    assert.deepEqual(r.body.curso, { id: h.ids.curso.A, nome: 'Curso Teste A' });
    assert.deepEqual(r.body.horas, { minima: 200, concluidas: 125, pendentes: 8, restantes: 75 });
    assert.equal(r.body.percentualConcluido, 62.5);
    assert.equal(r.body.cargaHorariaCumprida, false);
    assert.deepEqual(r.body.submissoes, { pendentes: 1, aprovadas: 4, rejeitadas: 2, aguardandoCorrecao: 1 });
    assert.ok(r.body.calculadoEm);
  });

  it('separa por categoria, com a meta visual do curso', async () => {
    const r = await h.api('GET', '/progresso', { como: 'ALUA1' });
    assert.deepEqual(r.body.porCategoria.map((c) => c.categoria.nome), ['Ensino', 'Extensão', 'Pesquisa']);
    assert.deepEqual(
      [categoria(r.body, 'Ensino').horasConcluidas, categoria(r.body, 'Ensino').meta, categoria(r.body, 'Ensino').percentualMeta],
      [40, 60, 66.7],
    );
    assert.deepEqual(
      [categoria(r.body, 'Pesquisa').horasConcluidas, categoria(r.body, 'Pesquisa').meta, categoria(r.body, 'Pesquisa').percentualMeta],
      [35, 50, 70],
    );
    const extensao = categoria(r.body, 'Extensão');
    assert.deepEqual([extensao.horasConcluidas, extensao.horasPendentes, extensao.meta, extensao.percentualMeta], [50, 8, 90, 55.6]);
  });

  it('acima da carga mínima: 0 h restantes e 100%', async () => {
    const r = await h.api('GET', '/progresso', { como: 'ALUA2' });
    assert.equal(r.body.horas.concluidas, 250);
    assert.equal(r.body.horas.restantes, 0);
    assert.equal(r.body.percentualConcluido, 100);
    assert.equal(r.body.cargaHorariaCumprida, true);
  });

  it('aluno sem submissões e curso sem metas: zeros e meta null', async () => {
    const r = await h.api('GET', '/progresso', { como: 'ALUB1' });
    assert.deepEqual(r.body.horas, { minima: 120, concluidas: 0, pendentes: 0, restantes: 120 });
    assert.equal(r.body.porCategoria.length, 3);
    assert.ok(r.body.porCategoria.every((c) => c.meta === null && c.percentualMeta === null));
  });

  it('mudar a carga mínima do curso recalcula na hora, sem mexer nas horas aprovadas', async () => {
    await h.prisma.curso.update({ where: { id: h.ids.curso.A }, data: { cargaHorariaMinima: 250 } });
    try {
      const r = await h.api('GET', '/progresso', { como: 'ALUA1' });
      assert.deepEqual(r.body.horas, { minima: 250, concluidas: 125, pendentes: 8, restantes: 125 });
      assert.equal(r.body.percentualConcluido, 50);
    } finally {
      await h.prisma.curso.update({ where: { id: h.ids.curso.A }, data: { cargaHorariaMinima: 200 } });
    }
  });

  it('aluno sem curso vinculado: 409', async () => {
    const r = await h.api('GET', '/progresso', { como: 'ALUSEM' });
    assert.equal(r.status, 409);
    assert.equal(r.body.erro.codigo, 'ALUNO_SEM_CURSO');
  });

  it('sem identificação: 401; perfis que não são aluno: 403', async () => {
    assert.equal((await h.api('GET', '/progresso')).status, 401);
    for (const como of ['ORG1', 'COOA', 'ADM1']) {
      assert.equal((await h.api('GET', '/progresso', { como })).status, 403, como);
    }
  });
});

describe('GET /api/progresso/:matricula', () => {
  it('aluno vê o próprio, mas não o de outro aluno (nem descobre se existe)', async () => {
    assert.equal((await h.api('GET', '/progresso/ALUA1', { como: 'ALUA1' })).status, 200);
    assert.equal((await h.api('GET', '/progresso/ALUA2', { como: 'ALUA1' })).status, 403);
    assert.equal((await h.api('GET', '/progresso/NAOEXISTE', { como: 'ALUA1' })).status, 403);
  });

  it('coordenador vê só alunos do curso que coordena', async () => {
    const r = await h.api('GET', '/progresso/alua1', { como: 'COOA' });
    assert.equal(r.status, 200);
    assert.equal(r.body.horas.concluidas, 125);
    assert.equal((await h.api('GET', '/progresso/ALUB1', { como: 'COOA' })).status, 403);
    assert.equal((await h.api('GET', '/progresso/ALUB1', { como: 'COOB' })).status, 200);
  });

  it('administrador vê qualquer aluno; 404 para quem não existe ou não é aluno', async () => {
    assert.equal((await h.api('GET', '/progresso/ALUB1', { como: 'ADM1' })).status, 200);
    assert.equal((await h.api('GET', '/progresso/NAOEXISTE', { como: 'ADM1' })).status, 404);
    assert.equal((await h.api('GET', '/progresso/ORG1', { como: 'ADM1' })).status, 404);
  });

  it('organizador não acessa; matrícula com formato inválido: 400', async () => {
    assert.equal((await h.api('GET', '/progresso/ALUA1', { como: 'ORG1' })).status, 403);
    assert.equal((await h.api('GET', `/progresso/${encodeURIComponent('a b')}`, { como: 'ADM1' })).status, 400);
  });
});
