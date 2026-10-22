// Cálculo do progresso de horas — função PURA (não acessa o banco).
// Recebe os totais já agrupados e devolve os números do dashboard.
//
// FÓRMULAS
//   concluídas  = soma de horasAprovadas das submissões APROVADAS
//   pendentes   = soma de horasSolicitadas das submissões PENDENTES (não contam como concluídas)
//   restantes   = máximo(0, cargaMínima − concluídas)          -> nunca negativo
//   percentual  = mínimo(100, concluídas ÷ cargaMínima × 100)  -> nunca passa de 100
//   concluída   = concluídas ≥ cargaMínima
//
// POR CATEGORIA (Ensino, Pesquisa, Extensão)
//   As mesmas somas, separadas por categoria. A META de cada categoria é só
//   visual: não limita o total nem impede a conclusão do curso.
//   percentualMeta = mínimo(100, concluídasNaCategoria ÷ meta × 100), ou null sem meta.
//
// Contas feitas em centésimos de hora (inteiros) para não acumular erro de arredondamento.
const { emCentesimos, deCentesimos, umaCasa } = require('../utils/numeros');

function percentual(parteCentesimos, totalCentesimos) {
  if (!totalCentesimos || totalCentesimos <= 0) return null;
  return Math.min(100, umaCasa((parteCentesimos / totalCentesimos) * 100));
}

/**
 * @param {object} p
 * @param {number} p.cargaMinima    carga mínima do curso (horas)
 * @param {Array}  p.grupos         [{ categoriaId, status, horasSolicitadas, horasAprovadas, quantidade, comCorrecao }]
 * @param {Array}  p.categorias     [{ id, nome, ativa }]
 * @param {Array}  p.metas          [{ categoriaId, horasMeta }]
 */
function calcularProgresso({ cargaMinima, grupos, categorias, metas = [] }) {
  const minimaC = emCentesimos(cargaMinima);
  const porCategoria = new Map(); // categoriaId -> { concluidas, pendentes }
  const contagem = { pendentes: 0, aprovadas: 0, rejeitadas: 0, aguardandoCorrecao: 0 };
  let concluidasC = 0;
  let pendentesC = 0;

  const acumulador = (categoriaId) => {
    if (!porCategoria.has(categoriaId)) porCategoria.set(categoriaId, { concluidas: 0, pendentes: 0 });
    return porCategoria.get(categoriaId);
  };

  for (const g of grupos) {
    if (g.status === 'APROVADA') {
      const h = emCentesimos(g.horasAprovadas);
      concluidasC += h;
      acumulador(g.categoriaId).concluidas += h;
      contagem.aprovadas += g.quantidade;
    } else if (g.status === 'PENDENTE') {
      const h = emCentesimos(g.horasSolicitadas);
      pendentesC += h;
      acumulador(g.categoriaId).pendentes += h;
      contagem.pendentes += g.quantidade;
    } else if (g.status === 'REJEITADA') {
      contagem.rejeitadas += g.quantidade;
      contagem.aguardandoCorrecao += g.comCorrecao || 0;
    }
  }

  const metaDe = new Map(metas.map((m) => [m.categoriaId, emCentesimos(m.horasMeta)]));

  // Mostra todas as categorias ativas e também as inativas que tenham horas do aluno.
  const linhas = categorias
    .filter((c) => c.ativa || porCategoria.has(c.id))
    .map((c) => {
      const soma = porCategoria.get(c.id) || { concluidas: 0, pendentes: 0 };
      const metaC = metaDe.get(c.id) ?? null;
      return {
        categoria: { id: c.id, nome: c.nome },
        horasConcluidas: deCentesimos(soma.concluidas),
        horasPendentes: deCentesimos(soma.pendentes),
        meta: metaC === null ? null : deCentesimos(metaC),
        percentualMeta: metaC === null ? null : percentual(soma.concluidas, metaC),
      };
    });

  return {
    horas: {
      minima: deCentesimos(minimaC),
      concluidas: deCentesimos(concluidasC),
      pendentes: deCentesimos(pendentesC),
      restantes: deCentesimos(Math.max(0, minimaC - concluidasC)),
    },
    percentualConcluido: percentual(concluidasC, minimaC) ?? 0,
    cargaHorariaCumprida: minimaC > 0 && concluidasC >= minimaC,
    porCategoria: linhas,
    submissoes: contagem,
  };
}

module.exports = { calcularProgresso };
