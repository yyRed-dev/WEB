// Identificação do usuário e controle de acesso.
//
// Decisão do grupo: SEM token. O usuário é identificado pela matrícula (a mesma
// da Unifor) enviada no cabeçalho HTTP:
//     X-Matricula: 2023104567
// O login de teste (POST /api/auth/login) confere a senha e devolve os dados do
// usuário; o front guarda a matrícula e a envia em toda requisição.
//
// TODA a descoberta de "quem está fazendo a requisição" fica neste arquivo.
// As rotas só usam `req.usuario`, `exigirUsuario` e `autorizar(...)`; quando
// houver integração com o login da Unifor, só `identificarUsuario` muda.
//
// Modos (IDENTIFICACAO_MODO no .env):
//   cabecalho (padrão) -> lê X-Matricula
//   nenhum             -> ninguém é identificado
const config = require('../config/env');
const AppError = require('../utils/AppError');
const usuarioService = require('../services/usuarioService');

const MATRICULA = /^[A-Z0-9]{3,20}$/;

/** Roda em toda requisição: preenche req.usuario (ou deixa null). */
async function identificarUsuario(req, _res, next) {
  req.usuario = null;
  if (config.identificacao.modo !== 'cabecalho') return next();

  const bruto = req.get('x-matricula');
  if (bruto === undefined || bruto.trim() === '') return next();
  const matricula = bruto.trim().toUpperCase();
  if (!MATRICULA.test(matricula)) throw new AppError(401, 'IDENTIFICACAO_INVALIDA', 'Matrícula de identificação inválida.');
  const usuario = await usuarioService.buscarAtivoPorMatricula(matricula);
  if (!usuario) throw new AppError(401, 'USUARIO_NAO_ENCONTRADO', 'Usuário não encontrado ou inativo.');
  req.usuario = usuario;
  next();
}

/** A rota exige um usuário identificado. */
function exigirUsuario(req, _res, next) {
  if (!req.usuario) {
    throw new AppError(401, 'IDENTIFICACAO_NECESSARIA', 'Faça login para acessar este recurso.');
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
