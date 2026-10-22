// Listas de apoio: categorias, tipos de atividade e cursos.
const prisma = require('../config/prisma');
const { paraNumero } = require('../utils/numeros');

async function listarCategorias({ incluirInativas = false } = {}) {
  const categorias = await prisma.categoria.findMany({
    where: incluirInativas ? {} : { ativa: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, descricao: true, ativa: true },
  });
  return categorias;
}

async function listarTipos({ incluirInativos = false } = {}) {
  return prisma.tipoAtividade.findMany({
    where: incluirInativos ? {} : { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, ativo: true },
  });
}

async function listarCursos() {
  const cursos = await prisma.curso.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    include: { metas: { include: { categoria: { select: { id: true, nome: true } } } } },
  });
  return cursos.map((c) => ({
    id: c.id,
    nome: c.nome,
    cargaHorariaMinima: paraNumero(c.cargaHorariaMinima),
    metasPorCategoria: c.metas
      .map((m) => ({ categoria: m.categoria, horasMeta: paraNumero(m.horasMeta) }))
      .sort((a, b) => a.categoria.nome.localeCompare(b.categoria.nome, 'pt-BR')),
  }));
}

module.exports = { listarCategorias, listarTipos, listarCursos };
