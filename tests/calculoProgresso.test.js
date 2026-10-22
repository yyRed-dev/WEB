// Testes UNITÁRIOS do cálculo de progresso (não usam banco nem API).
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calcularProgresso } = require('../src/services/calculoProgresso');

const CATEGORIAS = [
  { id: 1, nome: 'Ensino', ativa: true },
  { id: 2, nome: 'Extensão', ativa: true },
  { id: 3, nome: 'Pesquisa', ativa: true },
];
const METAS = [
  { categoriaId: 1, horasMeta: 60 },
  { categoriaId: 2, horasMeta: 90 },
  { categoriaId: 3, horasMeta: 50 },
];
const g = (categoriaId, status, horasSolicitadas, horasAprovadas, quantidade = 1, comCorrecao = 0) => ({
  categoriaId, status, horasSolicitadas, horasAprovadas, quantidade, comCorrecao,
});
const linha = (r, nome) => r.porCategoria.find((l) => l.categoria.nome === nome);

describe('calcularProgresso', () => {
  it('reproduz o dashboard: 125 h de 200 h = 62,5% e 75 h restantes', () => {
    const r = calcularProgresso({
      cargaMinima: 200,
      categorias: CATEGORIAS,
      metas: METAS,
      grupos: [
        g(1, 'APROVADA', 40, 40, 2),
        g(3, 'APROVADA', 35, 35),
        g(2, 'APROVADA', 60, 50),
        g(2, 'PENDENTE', 8, null),
        g(1, 'REJEITADA', 20, null, 1, 1),
      ],
    });
    assert.deepEqual(r.horas, { minima: 200, concluidas: 125, pendentes: 8, restantes: 75 });
    assert.equal(r.percentualConcluido, 62.5);
    assert.equal(r.cargaHorariaCumprida, false);
    assert.deepEqual(linha(r, 'Ensino'), { categoria: { id: 1, nome: 'Ensino' }, horasConcluidas: 40, horasPendentes: 0, meta: 60, percentualMeta: 66.7 });
    assert.deepEqual(linha(r, 'Pesquisa'), { categoria: { id: 3, nome: 'Pesquisa' }, horasConcluidas: 35, horasPendentes: 0, meta: 50, percentualMeta: 70 });
    assert.deepEqual(linha(r, 'Extensão'), { categoria: { id: 2, nome: 'Extensão' }, horasConcluidas: 50, horasPendentes: 8, meta: 90, percentualMeta: 55.6 });
    assert.deepEqual(r.submissoes, { pendentes: 1, aprovadas: 4, rejeitadas: 1, aguardandoCorrecao: 1 });
  });

  it('usa as horas APROVADAS (não as solicitadas) e não conta pendentes como concluídas', () => {
    const r = calcularProgresso({
      cargaMinima: 100, categorias: CATEGORIAS,
      grupos: [g(1, 'APROVADA', 60, 30), g(1, 'PENDENTE', 50, null)],
    });
    assert.equal(r.horas.concluidas, 30);
    assert.equal(r.horas.pendentes, 50);
    assert.equal(r.horas.restantes, 70);
    assert.equal(r.percentualConcluido, 30);
  });

  it('rejeitadas não somam horas', () => {
    const r = calcularProgresso({ cargaMinima: 100, categorias: CATEGORIAS, grupos: [g(1, 'REJEITADA', 40, null, 3)] });
    assert.equal(r.horas.concluidas, 0);
    assert.equal(r.horas.pendentes, 0);
    assert.equal(r.submissoes.rejeitadas, 3);
  });

  it('acima da carga mínima: restantes nunca negativas e percentual no máximo 100', () => {
    const r = calcularProgresso({ cargaMinima: 200, categorias: CATEGORIAS, grupos: [g(1, 'APROVADA', 250, 250)] });
    assert.equal(r.horas.concluidas, 250);
    assert.equal(r.horas.restantes, 0);
    assert.equal(r.percentualConcluido, 100);
    assert.equal(r.cargaHorariaCumprida, true);
  });

  it('exatamente na carga mínima conta como cumprida', () => {
    const r = calcularProgresso({ cargaMinima: 200, categorias: CATEGORIAS, grupos: [g(1, 'APROVADA', 200, 200)] });
    assert.equal(r.cargaHorariaCumprida, true);
    assert.equal(r.horas.restantes, 0);
  });

  it('a meta por categoria é só visual: não limita as horas nem o total', () => {
    const r = calcularProgresso({ cargaMinima: 200, categorias: CATEGORIAS, metas: METAS, grupos: [g(1, 'APROVADA', 80, 80)] });
    assert.equal(linha(r, 'Ensino').horasConcluidas, 80);
    assert.equal(linha(r, 'Ensino').percentualMeta, 100);
    assert.equal(r.horas.concluidas, 80);
    assert.equal(r.percentualConcluido, 40);
  });

  it('sem meta cadastrada: meta e percentualMeta são null', () => {
    const r = calcularProgresso({ cargaMinima: 120, categorias: CATEGORIAS, grupos: [g(1, 'APROVADA', 10, 10)] });
    assert.equal(linha(r, 'Ensino').meta, null);
    assert.equal(linha(r, 'Ensino').percentualMeta, null);
  });

  it('soma decimais sem erro de arredondamento (1,1 + 2,2 = 3,3)', () => {
    const r = calcularProgresso({
      cargaMinima: 10, categorias: CATEGORIAS,
      grupos: [g(1, 'APROVADA', 1.1, 1.1), g(3, 'APROVADA', 2.2, 2.2)],
    });
    assert.equal(r.horas.concluidas, 3.3);
    assert.equal(r.horas.restantes, 6.7);
    assert.equal(r.percentualConcluido, 33);
  });

  it('aceita valores Decimal/texto como os que o Prisma devolve', () => {
    const decimal = (valor) => ({ valueOf: () => String(valor), toString: () => String(valor) });
    const r = calcularProgresso({
      cargaMinima: decimal('200.00'), categorias: CATEGORIAS, metas: [{ categoriaId: 1, horasMeta: decimal('60.00') }],
      grupos: [g(1, 'APROVADA', decimal('30.50'), decimal('30.50'))],
    });
    assert.equal(r.horas.concluidas, 30.5);
    assert.equal(linha(r, 'Ensino').meta, 60);
  });

  it('aluno sem submissões: tudo zerado e todas as categorias ativas listadas', () => {
    const r = calcularProgresso({ cargaMinima: 200, categorias: CATEGORIAS, metas: METAS, grupos: [] });
    assert.deepEqual(r.horas, { minima: 200, concluidas: 0, pendentes: 0, restantes: 200 });
    assert.equal(r.percentualConcluido, 0);
    assert.equal(r.porCategoria.length, 3);
    assert.ok(r.porCategoria.every((l) => l.horasConcluidas === 0 && l.percentualMeta === 0));
  });

  it('categoria inativa aparece só se o aluno tiver horas nela', () => {
    const categorias = [...CATEGORIAS, { id: 9, nome: 'Antiga', ativa: false }, { id: 10, nome: 'Vazia', ativa: false }];
    const r = calcularProgresso({ cargaMinima: 100, categorias, grupos: [g(9, 'APROVADA', 5, 5)] });
    assert.equal(linha(r, 'Antiga').horasConcluidas, 5);
    assert.equal(linha(r, 'Vazia'), undefined);
    assert.equal(r.horas.concluidas, 5);
  });

  it('mudar a carga mínima recalcula sem mexer nas horas aprovadas', () => {
    const grupos = [g(1, 'APROVADA', 100, 100)];
    const antes = calcularProgresso({ cargaMinima: 200, categorias: CATEGORIAS, grupos });
    const depois = calcularProgresso({ cargaMinima: 250, categorias: CATEGORIAS, grupos });
    assert.equal(antes.horas.concluidas, depois.horas.concluidas);
    assert.equal(antes.percentualConcluido, 50);
    assert.equal(depois.percentualConcluido, 40);
    assert.equal(depois.horas.restantes, 150);
  });
});
