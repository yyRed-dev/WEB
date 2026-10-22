// GET de categorias, tipos de atividade e cursos.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

before(h.iniciar);
after(h.encerrar);

describe('GET /api/categorias', () => {
  it('lista Ensino, Extensão e Pesquisa em ordem alfabética, sem login', async () => {
    const r = await h.api('GET', '/categorias');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.categorias.map((c) => c.nome), ['Ensino', 'Extensão', 'Pesquisa']);
    assert.ok(r.body.categorias.every((c) => c.ativa === true && typeof c.id === 'number'));
  });

  it('esconde categoria inativa; administrador pode pedir as inativas', async () => {
    const antiga = await h.prisma.categoria.create({ data: { nome: 'Categoria Antiga', ativa: false } });
    const publica = await h.api('GET', '/categorias');
    assert.ok(!publica.body.categorias.some((c) => c.id === antiga.id));

    const admin = await h.api('GET', '/categorias?incluirInativas=true', { como: 'ADM1' });
    assert.equal(admin.status, 200);
    assert.ok(admin.body.categorias.some((c) => c.id === antiga.id && c.ativa === false));
  });

  it('incluirInativas por quem não é administrador: 403', async () => {
    assert.equal((await h.api('GET', '/categorias?incluirInativas=true', { como: 'ALUA1' })).status, 403);
    assert.equal((await h.api('GET', '/categorias?incluirInativas=true')).status, 403);
  });

  it('parâmetro inválido: 400', async () => {
    assert.equal((await h.api('GET', '/categorias?incluirInativas=talvez', { como: 'ADM1' })).status, 400);
  });
});

describe('GET /api/tipos-atividade', () => {
  it('lista os tipos usados nos filtros do catálogo', async () => {
    const r = await h.api('GET', '/tipos-atividade');
    assert.equal(r.status, 200);
    const nomes = r.body.tipos.map((t) => t.nome);
    for (const esperado of ['Evento', 'Minicurso', 'Workshop', 'Estágio']) assert.ok(nomes.includes(esperado), esperado);
  });
});

describe('GET /api/cursos', () => {
  it('lista cursos ativos com carga mínima e metas por categoria como números', async () => {
    const r = await h.api('GET', '/cursos');
    assert.equal(r.status, 200);
    const nomes = r.body.cursos.map((c) => c.nome);
    assert.ok(!nomes.includes('Curso Inativo'));
    const a = r.body.cursos.find((c) => c.nome === 'Curso Teste A');
    assert.equal(a.cargaHorariaMinima, 200);
    assert.deepEqual(a.metasPorCategoria.map((m) => [m.categoria.nome, m.horasMeta]), [['Ensino', 60], ['Extensão', 90], ['Pesquisa', 50]]);
    assert.deepEqual(r.body.cursos.find((c) => c.nome === 'Curso Teste B').metasPorCategoria, []);
  });
});
