// Consultas de usuários.
const prisma = require('../config/prisma');
const { paraNumero } = require('../utils/numeros');

const INCLUIR_CURSO = { curso: { select: { id: true, nome: true, cargaHorariaMinima: true } } };

/** Formato público de um usuário (o que a API devolve). */
function paraJson(u) {
  return {
    id: u.id,
    matricula: u.matricula,
    nome: u.nome,
    email: u.email,
    perfil: u.perfil,
    ativo: u.ativo,
    curso: u.curso
      ? { id: u.curso.id, nome: u.curso.nome, cargaHorariaMinima: paraNumero(u.curso.cargaHorariaMinima) }
      : null,
  };
}

async function buscarAtivoPorMatricula(matricula) {
  const usuario = await prisma.usuario.findUnique({ where: { matricula }, include: INCLUIR_CURSO });
  if (!usuario || !usuario.ativo) return null;
  return paraJson(usuario);
}

async function buscarPorMatricula(matricula) {
  const usuario = await prisma.usuario.findUnique({ where: { matricula }, include: INCLUIR_CURSO });
  return usuario ? paraJson(usuario) : null;
}

module.exports = { paraJson, buscarAtivoPorMatricula, buscarPorMatricula, INCLUIR_CURSO };
