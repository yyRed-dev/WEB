// Regras de integridade garantidas pelo PRÓPRIO banco (UNIQUE, chaves estrangeiras
// e as restrições CHECK da migração). Mesmo um bug no código não grava dados inconsistentes.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { semearBase, CATEGORIAS, TIPOS } = require('../prisma/seed');

before(h.iniciar);
after(h.encerrar);

describe('Dados iniciais', () => {
  it('rodar o seed de novo não duplica categorias nem tipos', async () => {
    await semearBase(h.prisma);
    assert.equal(await h.prisma.categoria.count(), CATEGORIAS.length);
    assert.equal(await h.prisma.tipoAtividade.count(), TIPOS.length);
  });
});

describe('UNIQUE e chaves estrangeiras', () => {
  it('matrícula duplicada é recusada (P2002)', async () => {
    await assert.rejects(
      h.prisma.usuario.create({ data: { matricula: 'ALUA1', nome: 'Outro' } }),
      (erro) => erro.code === 'P2002',
    );
  });

  it('o mesmo aluno não submete duas vezes a mesma atividade do catálogo', async () => {
    const atividade = await h.criarAtividadeNoBanco();
    await h.criarSubmissao('ALUA1', 'Ensino', { atividadeId: atividade.id });
    await assert.rejects(h.criarSubmissao('ALUA1', 'Ensino', { atividadeId: atividade.id }), (erro) => erro.code === 'P2002');
  });

  it('várias atividades EXTERNAS (sem atividadeId) do mesmo aluno são permitidas', async () => {
    await h.criarSubmissao('ALUB1', 'Extensão', { titulo: 'Estágio 1' });
    await h.criarSubmissao('ALUB1', 'Extensão', { titulo: 'Estágio 2' });
    assert.equal(await h.prisma.submissao.count({ where: { alunoId: h.ids.usuario.ALUB1, atividadeId: null } }), 2);
  });

  it('não apaga categoria em uso, nem curso com alunos, nem atividade com submissões', async () => {
    const atividade = await h.criarAtividadeNoBanco();
    await h.criarSubmissao('ALUA2', 'Ensino', { atividadeId: atividade.id });
    await assert.rejects(h.prisma.categoria.delete({ where: { id: h.ids.categoria.Ensino } }));
    await assert.rejects(h.prisma.curso.delete({ where: { id: h.ids.curso.A } }));
    await assert.rejects(h.prisma.atividade.delete({ where: { id: atividade.id } }));
  });

  it('não cria atividade com organizador inexistente (P2003)', async () => {
    await assert.rejects(h.criarAtividadeNoBanco({ organizadorId: 999999 }), (erro) => erro.code === 'P2003');
  });
});

describe('Restrições CHECK', () => {
  it('submissão APROVADA precisa de horas aprovadas', async () => {
    await assert.rejects(h.criarSubmissao('ALUA1', 'Ensino', { status: 'APROVADA' }));
  });

  it('horas aprovadas não podem passar das solicitadas', async () => {
    await assert.rejects(h.criarSubmissao('ALUA1', 'Ensino', { status: 'APROVADA', horasSolicitadas: 10, horasAprovadas: 11 }));
  });

  it('submissão REJEITADA precisa de justificativa', async () => {
    await assert.rejects(h.criarSubmissao('ALUA1', 'Ensino', { status: 'REJEITADA' }));
  });

  it('horas zeradas ou negativas são recusadas', async () => {
    await assert.rejects(h.criarSubmissao('ALUA1', 'Ensino', { horasSolicitadas: 0 }));
    await assert.rejects(h.criarAtividadeNoBanco({ cargaHoraria: -1 }));
    await assert.rejects(h.prisma.curso.create({ data: { nome: 'Curso Zero', cargaHorariaMinima: 0 } }));
  });

  it('término antes do início é recusado', async () => {
    const inicio = new Date(Date.now() + 10 * 864e5);
    await assert.rejects(h.criarAtividadeNoBanco({ dataInicio: inicio, dataFim: new Date(inicio.getTime() - 1000) }));
  });
});
