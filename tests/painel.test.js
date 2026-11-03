// Painel do coordenador: listar, aprovar e rejeitar submissões; progresso atualizado.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.iniciar);
after(h.encerrar);

/** Envia um certificado e devolve o id da submissão. */
async function enviar(matricula, campos = {}) {
  const r = await h.enviarCertificado(matricula, campos);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.submissao.id;
}

describe('GET /api/submissoes (painel)', () => {
  before(async () => {
    await enviar('ALUA1', { titulo: 'Workshop de Desenvolvimento Web', categoriaId: h.ids.categoria['Extensão'], cargaHoraria: '40' });
    await enviar('ALUA2', { titulo: 'Semana Acadêmica de Computação', categoriaId: h.ids.categoria['Extensão'], cargaHoraria: '12' });
    await enviar('ALUA2', { titulo: 'Minicurso de Pesquisa Científica', categoriaId: h.ids.categoria.Pesquisa, cargaHoraria: '6' });
    await enviar('ALUB1', { titulo: 'Curso de Língua Inglesa', cargaHoraria: '40' });
  });

  it('mostra só alunos do curso do coordenador, com os dados da tabela do painel', async () => {
    const r = await h.api('GET', '/submissoes', { como: 'COOA' });
    assert.equal(r.status, 200);
    assert.equal(r.body.submissoes.length, 3);
    assert.ok(r.body.submissoes.every((s) => ['ALUA1', 'ALUA2'].includes(s.aluno.matricula)));
    const s = r.body.submissoes.find((x) => x.aluno.matricula === 'ALUA1');
    assert.deepEqual(s.aluno, { id: h.ids.usuario.ALUA1, nome: 'Aluno A Um', matricula: 'ALUA1' });
    assert.equal(s.titulo, 'Workshop de Desenvolvimento Web');
    assert.equal(s.categoria.nome, 'Extensão');
    assert.equal(s.horasSolicitadas, 40);
    assert.equal(s.status, 'PENDENTE');
    assert.ok(s.certificado.url);
    assert.deepEqual(r.body.contagem, { todas: 3, pendentes: 3, aprovadas: 0, rejeitadas: 0 });

    const b = await h.api('GET', '/submissoes', { como: 'COOB' });
    assert.deepEqual(b.body.submissoes.map((x) => x.aluno.matricula), ['ALUB1']);
  });

  it('filtra por categoria, status e busca (nome, matrícula ou atividade)', async () => {
    const porCategoria = await h.api('GET', `/submissoes?categoriaId=${h.ids.categoria.Pesquisa}`, { como: 'COOA' });
    assert.deepEqual(porCategoria.body.submissoes.map((s) => s.titulo), ['Minicurso de Pesquisa Científica']);
    assert.equal((await h.api('GET', '/submissoes?busca=alua2', { como: 'COOA' })).body.submissoes.length, 2);
    assert.equal((await h.api('GET', '/submissoes?busca=Aluno%20A%20Um', { como: 'COOA' })).body.submissoes.length, 1);
    assert.equal((await h.api('GET', '/submissoes?busca=workshop', { como: 'COOA' })).body.submissoes.length, 1);
    assert.equal((await h.api('GET', '/submissoes?status=APROVADA', { como: 'COOA' })).body.submissoes.length, 0);
  });

  it('paginação', async () => {
    const r = await h.api('GET', '/submissoes?porPagina=2&pagina=2', { como: 'COOA' });
    assert.equal(r.body.submissoes.length, 1);
    assert.deepEqual(r.body.paginacao, { pagina: 2, porPagina: 2, total: 3, totalPaginas: 2 });
  });

  it('aluno: 403; sem login: 401; coordenador sem curso: 409', async () => {
    assert.equal((await h.api('GET', '/submissoes', { como: 'ALUA1' })).status, 403);
    assert.equal((await h.api('GET', '/submissoes')).status, 401);
    assert.equal((await h.api('GET', '/submissoes', { como: 'COOSEM' })).status, 409);
  });
});

describe('PATCH /api/submissoes/:id/aprovar', () => {
  it('aprova com as horas solicitadas (padrão) e o progresso do aluno sobe na hora', async () => {
    const antes = (await h.api('GET', '/progresso', { como: 'ALUA2' })).body;
    const id = await enviar('ALUA2', { titulo: 'Monitoria de Algoritmos', cargaHoraria: '30' });

    const r = await h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: {}, como: 'COOA' });
    assert.equal(r.status, 200);
    assert.equal(r.body.submissao.status, 'APROVADA');
    assert.equal(r.body.submissao.horasAprovadas, 30);
    assert.deepEqual(r.body.submissao.avaliador, { id: h.ids.usuario.COOA, nome: 'Coordenação A' });
    assert.equal(r.body.progressoAluno.horas.concluidas, antes.horas.concluidas + 30);

    const depois = (await h.api('GET', '/progresso', { como: 'ALUA2' })).body;
    assert.equal(depois.horas.concluidas, antes.horas.concluidas + 30);
    assert.equal(depois.porCategoria.find((c) => c.categoria.nome === 'Ensino').horasConcluidas, 30);
  });

  it('pode aprovar menos horas que as solicitadas (nunca mais)', async () => {
    const id = await enviar('ALUA1', { titulo: 'Curso longo', cargaHoraria: '20' });
    const mais = await h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: { horasAprovadas: 25 }, como: 'COOA' });
    assert.equal(mais.status, 400);
    const r = await h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: { horasAprovadas: 15, observacao: 'Só 15 h comprovadas no certificado.' }, como: 'COOA' });
    assert.equal(r.status, 200);
    assert.equal(r.body.submissao.horasAprovadas, 15);
    assert.equal(r.body.submissao.justificativa, 'Só 15 h comprovadas no certificado.');
  });

  it('só PENDENTE pode ser avaliada; dois coordenadores ao mesmo tempo: um ganha, o outro recebe 409', async () => {
    const id = await enviar('ALUA1', { titulo: 'Disputa de avaliação', cargaHoraria: '5' });
    const [a, b] = await Promise.all([
      h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: {}, como: 'COOA' }),
      h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: {}, como: 'COOA2' }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal(await h.prisma.avaliacao.count({ where: { submissaoId: id } }), 1);
    assert.equal((await h.api('PATCH', `/submissoes/${id}/rejeitar`, { corpo: { motivo: 'Mudei de ideia' }, como: 'COOA' })).status, 409);
  });

  it('coordenador de outro curso não acha a submissão (404); aluno não avalia (403)', async () => {
    const id = await enviar('ALUA1', { titulo: 'Fora do curso B', cargaHoraria: '5' });
    assert.equal((await h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: {}, como: 'COOB' })).status, 404);
    assert.equal((await h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: {}, como: 'ALUA1' })).status, 403);
    assert.equal((await h.api('PATCH', '/submissoes/999999/aprovar', { corpo: {}, como: 'COOA' })).status, 404);
  });
});

describe('PATCH /api/submissoes/:id/rejeitar', () => {
  it('exige motivo; o aluno vê o motivo; as horas não contam', async () => {
    const antes = (await h.api('GET', '/progresso', { como: 'ALUB1' })).body.horas.concluidas;
    const id = await enviar('ALUB1', { titulo: 'Palestra de Carreira', cargaHoraria: '4' });
    assert.equal((await h.api('PATCH', `/submissoes/${id}/rejeitar`, { corpo: {}, como: 'COOB' })).status, 400);
    assert.equal((await h.api('PATCH', `/submissoes/${id}/rejeitar`, { corpo: { motivo: 'ok' }, como: 'COOB' })).status, 400);

    const r = await h.api('PATCH', `/submissoes/${id}/rejeitar`, { corpo: { motivo: 'Certificado ilegível', permiteCorrecao: true }, como: 'COOB' });
    assert.equal(r.status, 200);
    assert.equal(r.body.submissao.status, 'REJEITADA');
    assert.equal(r.body.submissao.motivoRejeicao, 'Certificado ilegível');
    assert.equal(r.body.submissao.permiteCorrecao, true);

    const doAluno = await h.api('GET', `/submissoes/${id}`, { como: 'ALUB1' });
    assert.equal(doAluno.body.submissao.motivoRejeicao, 'Certificado ilegível');
    assert.equal((await h.api('GET', '/progresso', { como: 'ALUB1' })).body.horas.concluidas, antes);
    assert.equal((await h.api('GET', '/progresso', { como: 'ALUB1' })).body.submissoes.aguardandoCorrecao, 1);
  });
});

describe('GET /api/submissoes/:id (detalhe com histórico)', () => {
  it('mostra o histórico de decisões; outro aluno não vê (404)', async () => {
    const id = await enviar('ALUA1', { titulo: 'Com histórico', cargaHoraria: '8' });
    await h.api('PATCH', `/submissoes/${id}/aprovar`, { corpo: { horasAprovadas: 6 }, como: 'COOA' });
    const r = await h.api('GET', `/submissoes/${id}`, { como: 'COOA' });
    assert.equal(r.status, 200);
    assert.equal(r.body.submissao.historico.length, 1);
    assert.equal(r.body.submissao.historico[0].resultado, 'APROVADA');
    assert.equal(r.body.submissao.historico[0].horasAprovadas, 6);
    assert.equal(r.body.submissao.historico[0].avaliador.nome, 'Coordenação A');
    assert.equal((await h.api('GET', `/submissoes/${id}`, { como: 'ALUA2' })).status, 404);
    assert.equal((await h.api('GET', `/submissoes/${id}`, { como: 'ALUA1' })).status, 200);
  });
});
