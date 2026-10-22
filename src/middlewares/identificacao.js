// Identificação do usuário e controle de acesso.
//
// O LOGIN será feito pelo sistema da Unifor. Como a forma de integração ainda
// não foi definida, TODA a descoberta de "quem está fazendo a requisição" fica
// neste arquivo. Quando a integração existir, só `identificarUsuario` muda; as
// rotas continuam usando `req.usuario`, `exigirUsuario` e `autorizar(...)`.
//
// Modo atual (somente desenvolvimento e testes): cabeçalho HTTP
//     X-Matricula: 2023104567
// Qualquer pessoa pode enviar esse cabeçalho, por isso ele é PROIBIDO em
// produção (ver src/config/env.js). Ele NÃO é autenticação de verdade.
const config = require('../config/env');
const AppError = require('../utils/AppError');
const usuarioService = require('../services/usuarioService');

const MATRICULA = /^[A-Z0-9]{3,20}$/;

/** Roda em toda requisição: preenche req.usuario (ou null). */
async function identificarUsuario(req, _res, next) {
  req.usuario = null;

  if (config.identificacao.modo === 'cabecalho') {
    const bruto = req.get('x-matricula');
    if (bruto !== undefined && bruto.trim() !== '') {
      const matricula = bruto.trim().toUpperCase();
      if (!MATRICULA.test(matricula)) {
        throw new AppError(401, 'IDENTIFICACAO_INVALIDA', 'Matrícula de identificação inválida.');
      }
      const usuario = await usuarioService.buscarAtivoPorMatricula(matricula);
      if (!usuario) {
        throw new AppError(401, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado ou inativo.');
      }
      req.usuario = usuario;
    }
  }
  next();
}

/** A rota exige um usuário identificado. */
function exigirUsuario(req, _res, next) {
  if (!req.usuario) {
    throw new AppError(401, 'IDENTIFICACAO_NECESSARIA', 'Identifique-se para acessar este recurso.');
  }
  next();
}

/** A rota exige um dos perfis informados. Já inclui exigirUsuario. */
function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    exigirUsuario(req, res, () => {
      if (!perfisPermitidos.includes(req.usuario.perfil)) {
        throw new AppError(403, 'ACESSO_NEGADO', 'Seu perfil não tem permissão para esta operação.');
      }
      next();
    });
  };
}

module.exports = { identificarUsuario, exigirUsuario, autorizar };
