// CRUD de atividades: criar, consultar (com filtros), editar e cancelar.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.iniciar);
after(h.encerrar);

const DIA = 864e5;

describe('POST /api/atividades (criar)', () => {
  it('organizador cria: 201, Location e campos no formato da API', async () => {
    const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ vagas: 80 }), como: 'ORG1' });
    assert.equal(r.status, 201);
    const a = r.body.atividade;
    assert.equal(r.headers.get('location'), `/api/atividades/${a.id}`);
    assert.equal(a.titulo, 'Workshop de Desenvolvimento Web');
    assert.equal(a.cargaHoraria, 4); // número, não "4.00"
    assert.equal(a.vagas, 80);
    assert.deepEqual(a.categoria, { id: h.ids.categoria['Extensão'], nome: 'Extensão' });
    assert.deepEqual(a.tipo, { id: h.ids.tipo.Workshop, nome: 'Workshop' });
    assert.deepEqual(a.organizador, { id: h.ids.usuario.ORG1, nome: 'Organizador Um' });
    assert.equal(a.status, 'ATIVA');
    assert.equal(a.situacao, 'FUTURA');
    assert.equal(a.inscricoesAbertas, true);
    assert.deepEqual(a.cursosRecomendados, []);
    assert.equal(a.recomendadaParaVoce, null);
  });

  it('data sem fuso é lida no horário de Fortaleza (14:00 -03:00 = 17:00 UTC)', async () => {
    const a = await h.criarAtividade({ dataInicio: '2030-05-10T14:00', dataFim: '2030-05-10T18:30' });
    assert.equal(a.dataInicio, '2030-05-10T17:00:00.000Z');
    assert.equal(a.dataFim, '2030-05-10T21:30:00.000Z');
  });

  it('ignora organizadorId, status e id enviados no corpo', async () => {
    const a = await h.criarAtividade({ organizadorId: h.ids.usuario.ORG2, status: 'CANCELADA', id: 999999 });
    assert.equal(a.organizador.id, h.ids.usuario.ORG1);
    assert.equal(a.status, 'ATIVA');
    assert.notEqual(a.id, 999999);
  });

  it('administrador também pode criar', async () => {
    const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida(), como: 'ADM1' });
    assert.equal(r.status, 201);
    assert.equal(r.body.atividade.organizador.id, h.ids.usuario.ADM1);
  });

  it('aluno e coordenador não podem criar (403); sem identificação, 401', async () => {
    assert.equal((await h.api('POST', '/atividades', { corpo: h.atividadeValida(), como: 'ALUA1' })).status, 403);
    assert.equal((await h.api('POST', '/atividades', { corpo: h.atividadeValida(), como: 'COOA' })).status, 403);
    assert.equal((await h.api('POST', '/atividades', { corpo: h.atividadeValida() })).status, 401);
  });

  it('campos obrigatórios ausentes: 400 com o erro de cada campo', async () => {
    const r = await h.api('POST', '/atividades', { corpo: {}, como: 'ORG1' });
    assert.equal(r.status, 400);
    assert.deepEqual(
      Object.keys(r.body.erro.detalhes.campos).sort(),
      ['cargaHoraria', 'categoriaId', 'dataInicio', 'descricao', 'modalidade', 'tipoId', 'titulo'],
    );
  });

  it('término antes do início: 400', async () => {
    const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ dataFim: h.dataLocal(9) }), como: 'ORG1' });
    assert.equal(r.status, 400);
    assert.ok(r.body.erro.detalhes.campos.dataFim);
  });

  it('presencial sem local: 400; online exige link ou local', async () => {
    const r1 = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ local: null }), como: 'ORG1' });
    assert.equal(r1.status, 400);
    assert.ok(r1.body.erro.detalhes.campos.local);

    const r2 = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ modalidade: 'ONLINE', local: null }), como: 'ORG1' });
    assert.equal(r2.status, 400);
    assert.ok(r2.body.erro.detalhes.campos.link);

    const r3 = await h.api('POST', '/atividades', {
      corpo: h.atividadeValida({ modalidade: 'online', local: null, link: 'https://teams.exemplo.com/reuniao' }), como: 'ORG1',
    });
    assert.equal(r3.status, 201);
    assert.equal(r3.body.atividade.modalidade, 'ONLINE');
  });

  it('recusa link e imagem que não sejam http(s)', async () => {
    const r1 = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ link: 'javascript:alert(1)' }), como: 'ORG1' });
    const r2 = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ imagemUrl: 'ftp://x/img.png' }), como: 'ORG1' });
    assert.equal(r1.status, 400);
    assert.equal(r2.status, 400);
  });

  it('valida a carga horária (> 0, até 2 casas decimais)', async () => {
    for (const carga of [0, -2, 1.234, 'abc', 1000]) {
      const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ cargaHoraria: carga }), como: 'ORG1' });
      assert.equal(r.status, 400, `carga ${carga}`);
    }
    const ok = await h.criarAtividade({ cargaHoraria: '1,5' });
    assert.equal(ok.cargaHoraria, 1.5);
  });

  it('prazo de inscrição depois do fim da atividade: 400', async () => {
    const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ prazoInscricao: h.dataLocal(11) }), como: 'ORG1' });
    assert.equal(r.status, 400);
    assert.ok(r.body.erro.detalhes.campos.prazoInscricao);
  });

  it('data inexistente (30/02): 400', async () => {
    const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ dataInicio: '2030-02-30T10:00', dataFim: null }), como: 'ORG1' });
    assert.equal(r.status, 400);
    assert.ok(r.body.erro.detalhes.campos.dataInicio);
  });

  it('categoria/tipo inexistentes ou inativos: 400', async () => {
    const inativa = await h.prisma.categoria.create({ data: { nome: 'Inativa Teste', ativa: false } });
    const casos = [{ categoriaId: 99999 }, { categoriaId: inativa.id }, { tipoId: 99999 }];
    for (const extra of casos) {
      const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida(extra), como: 'ORG1' });
      assert.equal(r.status, 400, JSON.stringify(extra));
    }
  });

  it('cursos recomendados: aceita cursos ativos e recusa inexistentes ou inativos', async () => {
    const a = await h.criarAtividade({ cursoIds: [h.ids.curso.A, h.ids.curso.A] });
    assert.deepEqual(a.cursosRecomendados, [{ id: h.ids.curso.A, nome: 'Curso Teste A' }]);
    for (const cursoIds of [[99999], [h.ids.curso.inativo], 'A']) {
      const r = await h.api('POST', '/atividades', { corpo: h.atividadeValida({ cursoIds }), como: 'ORG1' });
      assert.equal(r.status, 400, JSON.stringify(cursoIds));
    }
  });
});

describe('GET /api/atividades/:id (detalhe)', () => {
  it('é público e indica se é recomendada para o curso de quem consulta', async () => {
    const a = await h.criarAtividade({ cursoIds: [h.ids.curso.A] });
    const anonimo = await h.api('GET', `/atividades/${a.id}`);
    assert.equal(anonimo.status, 200);
    assert.equal(anonimo.body.atividade.recomendadaParaVoce, null);
    assert.equal((await h.api('GET', `/atividades/${a.id}`, { como: 'ALUA1' })).body.atividade.recomendadaParaVoce, true);
    assert.equal((await h.api('GET', `/atividades/${a.id}`, { como: 'ALUB1' })).body.atividade.recomendadaParaVoce, false);
  });

  it('inexistente: 404; id inválido: 400', async () => {
    assert.equal((await h.api('GET', '/atividades/999999')).status, 404);
    assert.equal((await h.api('GET', '/atividades/abc')).status, 400);
  });
});

describe('GET /api/atividades (catálogo e filtros)', () => {
  let ids;

  before(async () => {
    // Cenário próprio, isolado das atividades criadas acima.
    await h.prisma.atividadeCurso.deleteMany();
    await h.prisma.atividade.deleteMany();
    const agora = Date.now();
    const criar = (campos) => h.criarAtividadeNoBanco(campos);
    const web = await criar({
      titulo: 'Workshop de Desenvolvimento Web', categoriaId: h.ids.categoria['Extensão'], tipoId: h.ids.tipo.Workshop,
      dataInicio: new Date(agora + 3 * DIA), cargaHoraria: 4, organizadorId: h.ids.usuario.ORG1,
    });
    const semana = await criar({
      titulo: 'Semana Acadêmica de Computação', categoriaId: h.ids.categoria.Ensino, tipoId: h.ids.tipo.Evento,
      dataInicio: new Date(agora + 10 * DIA), dataFim: new Date(agora + 12 * DIA), cargaHoraria: 10, organizadorId: h.ids.usuario.ORG2,
      cursos: { create: [{ cursoId: h.ids.curso.A }] },
    });
    const minicurso = await criar({
      titulo: 'Minicurso de Pesquisa Científica', categoriaId: h.ids.categoria.Pesquisa, tipoId: h.ids.tipo.Minicurso,
      modalidade: 'ONLINE', local: 'Online (via Microsoft Teams)', dataInicio: new Date(agora + 20 * DIA), cargaHoraria: 6,
      organizadorId: h.ids.usuario.ORG1, cursos: { create: [{ cursoId: h.ids.curso.B }] },
    });
    const emAndamento = await criar({
      titulo: 'Projeto em andamento', dataInicio: new Date(agora - 2 * DIA), dataFim: new Date(agora + 2 * DIA),
    });
    const passada = await criar({ titulo: 'Palestra que já passou', dataInicio: new Date(agora - 30 * DIA), cargaHoraria: 2 });
    const cancelada = await criar({ titulo: 'Evento cancelado', dataInicio: new Date(agora + 4 * DIA), status: 'CANCELADA' });
    ids = { web: web.id, semana: semana.id, minicurso: minicurso.id, emAndamento: emAndamento.id, passada: passada.id, cancelada: cancelada.id };
  });

  const listar = async (query = '', como) => {
    const r = await h.api('GET', `/atividades${query}`, { como });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body;
  };
  const idsDe = (corpo) => corpo.atividades.map((a) => a.id);

  it('padrão: só ativas que ainda vão acontecer (ou em andamento), da mais próxima para a mais distante', async () => {
    const corpo = await listar();
    assert.deepEqual(idsDe(corpo), [ids.emAndamento, ids.web, ids.semana, ids.minicurso]);
    assert.equal(corpo.paginacao.total, 4);
    assert.equal(corpo.atividades[0].situacao, 'EM_ANDAMENTO');
  });

  it('situacao=passadas mostra o histórico; todas junta as duas', async () => {
    assert.deepEqual(idsDe(await listar('?situacao=passadas')), [ids.passada]);
    assert.equal((await listar('?situacao=todas')).paginacao.total, 5);
  });

  it('canceladas só aparecem com incluirCanceladas=true', async () => {
    assert.ok(!idsDe(await listar()).includes(ids.cancelada));
    const corpo = await listar('?incluirCanceladas=true');
    const c = corpo.atividades.find((a) => a.id === ids.cancelada);
    assert.equal(c.situacao, 'CANCELADA');
    assert.equal(c.inscricoesAbertas, false);
  });

  it('filtra por categoria, tipo e modalidade', async () => {
    assert.deepEqual(idsDe(await listar(`?categoriaId=${h.ids.categoria.Pesquisa}`)), [ids.minicurso]);
    assert.deepEqual(idsDe(await listar(`?tipoId=${h.ids.tipo.Workshop}`)), [ids.web]);
    assert.deepEqual(idsDe(await listar('?modalidade=online')), [ids.minicurso]);
  });

  it('busca no título, na descrição, na categoria e no tipo, sem diferenciar maiúsculas', async () => {
    assert.deepEqual(idsDe(await listar('?busca=WORKSHOP')), [ids.web]);
    assert.deepEqual(idsDe(await listar(`?busca=${encodeURIComponent('Extensão')}`)), [ids.web]);
    assert.deepEqual(idsDe(await listar('?busca=minicurso')), [ids.minicurso]);
    assert.deepEqual(idsDe(await listar('?busca=inexistente-xyz')), []);
  });

  it('filtra por período (data de início) e por carga horária', async () => {
    const d = (dias) => new Date(Date.now() + dias * DIA).toISOString().slice(0, 10);
    assert.deepEqual(idsDe(await listar(`?de=${d(5)}&ate=${d(15)}`)), [ids.semana]);
    assert.deepEqual(idsDe(await listar('?cargaMin=5&cargaMax=8')), [ids.minicurso]);
  });

  it('compatíveis com o curso: por cursoId ou pelo curso de quem está identificado', async () => {
    assert.deepEqual(idsDe(await listar(`?cursoId=${h.ids.curso.B}`)), [ids.minicurso]);
    const doAluno = await listar('?compativeis=true', 'ALUA1');
    assert.deepEqual(idsDe(doAluno), [ids.semana]);
    assert.equal(doAluno.atividades[0].recomendadaParaVoce, true);
    // Sem o filtro, o aluno vê TODAS, com o destaque nas do seu curso
    const todas = await listar('', 'ALUA1');
    assert.equal(todas.atividades.length, 4);
    assert.deepEqual(todas.atividades.filter((a) => a.recomendadaParaVoce).map((a) => a.id), [ids.semana]);
  });

  it('compativeis=true sem curso conhecido: 400', async () => {
    assert.equal((await h.api('GET', '/atividades?compativeis=true')).status, 400);
    assert.equal((await h.api('GET', '/atividades?compativeis=true', { como: 'ORG1' })).status, 400);
  });

  it('minhas=true mostra as do organizador identificado (exige identificação)', async () => {
    assert.deepEqual(idsDe(await listar('?minhas=true', 'ORG2')), [ids.semana]);
    assert.equal((await h.api('GET', '/atividades?minhas=true')).status, 401);
  });

  it('paginação', async () => {
    const p2 = await listar('?porPagina=2&pagina=2');
    assert.deepEqual(idsDe(p2), [ids.semana, ids.minicurso]);
    assert.deepEqual(p2.paginacao, { pagina: 2, porPagina: 2, total: 4, totalPaginas: 2 });
  });

  it('parâmetros inválidos: 400', async () => {
    for (const q of ['?situacao=amanha', '?de=2030-12-31&ate=2030-01-01', '?porPagina=1000', '?categoriaId=abc', '?cargaMin=10&cargaMax=2', '?de=31/12/2030']) {
      assert.equal((await h.api('GET', `/atividades${q}`)).status, 400, q);
    }
  });
});

describe('PATCH /api/atividades/:id (editar)', () => {
  it('o organizador dono altera só os campos enviados', async () => {
    const a = await h.criarAtividade({ vagas: 30 });
    const r = await h.api('PATCH', `/atividades/${a.id}`, { corpo: { titulo: 'Workshop de Web Moderno', vagas: null }, como: 'ORG1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.atividade.titulo, 'Workshop de Web Moderno');
    assert.equal(r.body.atividade.vagas, null);
    assert.equal(r.body.atividade.local, 'Auditório Central');
    assert.equal(r.body.atividade.cargaHoraria, 4);
  });

  it('outro organizador: 403; administrador: 200; aluno: 403', async () => {
    const a = await h.criarAtividade();
    assert.equal((await h.api('PATCH', `/atividades/${a.id}`, { corpo: { cargaHoraria: 5 }, como: 'ORG2' })).status, 403);
    assert.equal((await h.api('PATCH', `/atividades/${a.id}`, { corpo: { cargaHoraria: 5 }, como: 'ALUA1' })).status, 403);
    const admin = await h.api('PATCH', `/atividades/${a.id}`, { corpo: { cargaHoraria: 5 }, como: 'ADM1' });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.atividade.cargaHoraria, 5);
  });

  it('corpo sem campos conhecidos: 400', async () => {
    const a = await h.criarAtividade();
    const r = await h.api('PATCH', `/atividades/${a.id}`, { corpo: { organizadorId: 1 }, como: 'ORG1' });
    assert.equal(r.status, 400);
    assert.equal(r.body.erro.codigo, 'NADA_PARA_ATUALIZAR');
  });

  it('regras entre campos usam o valor atual quando o campo não é enviado', async () => {
    const a = await h.criarAtividade();
    // novo término antes do início já gravado
    assert.equal((await h.api('PATCH', `/atividades/${a.id}`, { corpo: { dataFim: h.dataLocal(9) }, como: 'ORG1' })).status, 400);
    // apagar o local de uma atividade presencial
    assert.equal((await h.api('PATCH', `/atividades/${a.id}`, { corpo: { local: null }, como: 'ORG1' })).status, 400);
    // virar ONLINE mantendo o local já gravado é aceito
    assert.equal((await h.api('PATCH', `/atividades/${a.id}`, { corpo: { modalidade: 'ONLINE' }, como: 'ORG1' })).status, 200);
  });

  it('substitui a lista de cursos recomendados', async () => {
    const a = await h.criarAtividade({ cursoIds: [h.ids.curso.A] });
    const r1 = await h.api('PATCH', `/atividades/${a.id}`, { corpo: { cursoIds: [h.ids.curso.B] }, como: 'ORG1' });
    assert.deepEqual(r1.body.atividade.cursosRecomendados.map((c) => c.id), [h.ids.curso.B]);
    const r2 = await h.api('PATCH', `/atividades/${a.id}`, { corpo: { cursoIds: [] }, como: 'ORG1' });
    assert.deepEqual(r2.body.atividade.cursosRecomendados, []);
  });

  it('atividade inexistente: 404', async () => {
    assert.equal((await h.api('PATCH', '/atividades/999999', { corpo: { titulo: 'Qualquer' }, como: 'ADM1' })).status, 404);
  });
});

describe('DELETE /api/atividades/:id (cancelar)', () => {
  it('cancela sem apagar: continua consultável, sai do catálogo padrão', async () => {
    const a = await h.criarAtividade({ titulo: 'Atividade para cancelar' });
    const r = await h.api('DELETE', `/atividades/${a.id}`, { corpo: { motivo: 'Palestrante indisponível' }, como: 'ORG1' });
    assert.equal(r.status, 200);
    assert.equal(r.body.atividade.status, 'CANCELADA');
    assert.equal(r.body.atividade.motivoCancelamento, 'Palestrante indisponível');
    assert.equal(r.body.atividade.situacao, 'CANCELADA');

    assert.equal((await h.api('GET', `/atividades/${a.id}`)).status, 200);
    const catalogo = await h.api('GET', '/atividades?porPagina=100');
    assert.ok(!catalogo.body.atividades.some((x) => x.id === a.id));
  });

  it('cancelar de novo: 409; editar cancelada: 409', async () => {
    const a = await h.criarAtividade();
    assert.equal((await h.api('DELETE', `/atividades/${a.id}`, { como: 'ORG1' })).status, 200); // sem corpo
    assert.equal((await h.api('DELETE', `/atividades/${a.id}`, { como: 'ORG1' })).status, 409);
    assert.equal((await h.api('PATCH', `/atividades/${a.id}`, { corpo: { titulo: 'Novo título' }, como: 'ORG1' })).status, 409);
  });

  it('só o dono ou o administrador cancelam', async () => {
    const a = await h.criarAtividade();
    assert.equal((await h.api('DELETE', `/atividades/${a.id}`, { como: 'ORG2' })).status, 403);
    assert.equal((await h.api('DELETE', `/atividades/${a.id}`, { como: 'ALUA1' })).status, 403);
    assert.equal((await h.api('DELETE', `/atividades/${a.id}`, { como: 'ADM1' })).status, 200);
  });

  it('as submissões ligadas à atividade continuam existindo', async () => {
    const a = await h.criarAtividade();
    const s = await h.criarSubmissao('ALUA1', 'Extensão', { atividadeId: a.id, horasSolicitadas: 4 });
    await h.api('DELETE', `/atividades/${a.id}`, { como: 'ORG1' });
    const ainda = await h.prisma.submissao.findUnique({ where: { id: s.id } });
    assert.equal(ainda.atividadeId, a.id);
  });
});
