const catalogoService = require('../services/catalogoService');
const AppError = require('../utils/AppError');
const v = require('../utils/validacao');
const { PERFIS } = require('../config/perfis');

/** Itens inativos só aparecem para o administrador (gestão). */
function querInativos(req, nomeParametro) {
  const valor = v.validar({ [nomeParametro]: v.booleano(req.query[nomeParametro], nomeParametro) })[nomeParametro];
  if (valor && req.usuario?.perfil !== PERFIS.ADMINISTRADOR) {
    throw new AppError(403, 'ACESSO_NEGADO', 'Somente administradores podem listar itens inativos.');
  }
  return valor;
}

async function categorias(req, res) {
  res.json({ categorias: await catalogoService.listarCategorias({ incluirInativas: querInativos(req, 'incluirInativas') }) });
}

async function tipos(req, res) {
  res.json({ tipos: await catalogoService.listarTipos({ incluirInativos: querInativos(req, 'incluirInativos') }) });
}

async function cursos(_req, res) {
  res.json({ cursos: await catalogoService.listarCursos() });
}

module.exports = { categorias, tipos, cursos };
