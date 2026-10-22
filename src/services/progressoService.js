// Busca no banco os dados do progresso de um aluno e chama o cálculo.
const prisma = require('../config/prisma');
const AppError = require('../utils/AppError');
const v = require('../utils/validacao');
const { PERFIS } = require('../config/perfis');
const { calcularProgresso } = require('./calculoProgresso');

/**
 * Quem pode ver o progresso de quem:
 *   ALUNO          -> só o próprio
 *   COORDENADOR    -> alunos do curso que coordena (curso_id do coordenador)
 *   ADMINISTRADOR  -> qualquer aluno
 *   ORGANIZADOR    -> ninguém
 */
function verificarAcesso(solicitante, aluno) {
  if (solicitante.perfil === PERFIS.ADMINISTRADOR) return;
  if (solicitante.perfil === PERFIS.ALUNO && solicitante.id === aluno.id) return;
  if (solicitante.perfil === PERFIS.COORDENADOR && solicitante.curso && solicitante.curso.id === aluno.cursoId) return;
  throw new AppError(403, 'ACESSO_NEGADO', 'Você não tem permissão para ver o progresso deste aluno.');
}

async function progressoDoAluno(alunoId) {
  const aluno = await prisma.usuario.findUnique({
    where: { id: alunoId },
    include: { curso: true },
  });
  if (!aluno || aluno.perfil !== PERFIS.ALUNO) {
    throw new AppError(404, 'ALUNO_NAO_ENCONTRADO', 'Aluno não encontrado.');
  }
  if (!aluno.curso) {
    throw new AppError(409, 'ALUNO_SEM_CURSO', 'O aluno não está vinculado a um curso.');
  }

  // Leituras na mesma transação para os números serem coerentes entre si.
  const [grupos, rejeitadasComCorrecao, categorias, metas] = await prisma.$transaction([
    prisma.submissao.groupBy({
      by: ['categoriaId', 'status'],
      where: { alunoId },
      _sum: { horasSolicitadas: true, horasAprovadas: true },
      _count: { _all: true },
      orderBy: [{ categoriaId: 'asc' }, { status: 'asc' }],
    }),
    prisma.submissao.groupBy({
      by: ['categoriaId'],
      where: { alunoId, status: 'REJEITADA', permiteCorrecao: true },
      _count: { _all: true },
      orderBy: { categoriaId: 'asc' },
    }),
    prisma.categoria.findMany({ orderBy: { nome: 'asc' }, select: { id: true, nome: true, ativa: true } }),
    prisma.metaCategoriaCurso.findMany({ where: { cursoId: aluno.curso.id } }),
  ]);

  const correcaoPorCategoria = new Map(rejeitadasComCorrecao.map((g) => [g.categoriaId, g._count._all]));

  const resultado = calcularProgresso({
    cargaMinima: aluno.curso.cargaHorariaMinima,
    grupos: grupos.map((g) => ({
      categoriaId: g.categoriaId,
      status: g.status,
      horasSolicitadas: g._sum.horasSolicitadas,
      horasAprovadas: g._sum.horasAprovadas,
      quantidade: g._count._all,
      comCorrecao: g.status === 'REJEITADA' ? correcaoPorCategoria.get(g.categoriaId) || 0 : 0,
    })),
    categorias,
    metas: metas.map((m) => ({ categoriaId: m.categoriaId, horasMeta: m.horasMeta })),
  });

  return {
    aluno: { id: aluno.id, matricula: aluno.matricula, nome: aluno.nome },
    curso: { id: aluno.curso.id, nome: aluno.curso.nome },
    ...resultado,
    calculadoEm: new Date(),
  };
}

/** GET /progresso — o próprio aluno. */
async function meuProgresso(usuario) {
  if (usuario.perfil !== PERFIS.ALUNO) {
    throw new AppError(403, 'ACESSO_NEGADO', 'Apenas alunos têm progresso de horas. Use /progresso/:matricula.');
  }
  return progressoDoAluno(usuario.id);
}

/** GET /progresso/:matricula — aluno (o próprio), coordenador ou administrador. */
async function progressoPorMatricula(matriculaBruta, solicitante) {
  const { matricula } = v.validar({ matricula: v.matricula(matriculaBruta) });
  const aluno = await prisma.usuario.findUnique({ where: { matricula } });
  // Mesmo erro para "não existe" e "não é aluno", sem expor quem existe.
  if (!aluno || aluno.perfil !== PERFIS.ALUNO) {
    if (solicitante.perfil === PERFIS.ALUNO) {
      throw new AppError(403, 'ACESSO_NEGADO', 'Você não tem permissão para ver o progresso deste aluno.');
    }
    throw new AppError(404, 'ALUNO_NAO_ENCONTRADO', 'Aluno não encontrado.');
  }
  verificarAcesso(solicitante, aluno);
  return progressoDoAluno(aluno.id);
}

module.exports = { meuProgresso, progressoPorMatricula };
