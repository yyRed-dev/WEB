// Tratamento CENTRALIZADO de erros. Toda resposta de erro tem o formato:
//   { "erro": { "codigo": "ALGO", "mensagem": "Texto para o usuário", "detalhes": {...} } }
// Erros inesperados viram 500 genérico: o detalhe técnico fica só no log do servidor.
const { Prisma } = require('@prisma/client');
const multer = require('multer');
const AppError = require('../utils/AppError');
const config = require('../config/env');

function rotaNaoEncontrada(req, _res, next) {
  next(new AppError(404, 'ROTA_NAO_ENCONTRADA', `Rota não encontrada: ${req.method} ${req.path}`));
}

/**
 * Erros conhecidos do Prisma que podem acontecer mesmo com o código certo
 * (ex.: duas pessoas gravando ao mesmo tempo). Os códigos estão em
 * https://www.prisma.io/docs/orm/reference/error-reference
 */
function traduzirErroPrisma(erro) {
  if (!(erro instanceof Prisma.PrismaClientKnownRequestError)) return null;
  switch (erro.code) {
    case 'P2002': // violou um UNIQUE
      return new AppError(409, 'REGISTRO_DUPLICADO', 'Já existe um registro com esses dados.');
    case 'P2003': // chave estrangeira: referência inexistente ou registro em uso
      return new AppError(409, 'REFERENCIA_INVALIDA', 'O registro referenciado não existe ou está em uso.');
    case 'P2025': // registro não encontrado em update/delete
      return new AppError(404, 'NAO_ENCONTRADO', 'Registro não encontrado.');
    default:
      return null;
  }
}

/** Erros do upload (multer): arquivo grande demais, campo errado etc. */
function traduzirErroUpload(erro) {
  if (!(erro instanceof multer.MulterError)) return null;
  if (erro.code === 'LIMIT_FILE_SIZE') {
    const mb = Math.round(config.arquivos.tamanhoMaximoBytes / (1024 * 1024));
    return new AppError(413, 'ARQUIVO_MUITO_GRANDE', `O arquivo deve ter no máximo ${mb} MB.`);
  }
  if (erro.code === 'LIMIT_UNEXPECTED_FILE' || erro.code === 'LIMIT_FILE_COUNT') {
    return new AppError(400, 'ARQUIVO_INVALIDO', 'Envie um único arquivo, no campo "arquivo".');
  }
  return new AppError(400, 'FORMULARIO_INVALIDO', 'O formulário enviado é inválido ou grande demais.');
}

// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, _next) {
  const conhecido = erro instanceof AppError ? erro : traduzirErroPrisma(erro) || traduzirErroUpload(erro);
  if (conhecido) {
    const corpo = { codigo: conhecido.codigo, mensagem: conhecido.message };
    if (conhecido.detalhes) corpo.detalhes = conhecido.detalhes;
    if (conhecido.status === 429 && conhecido.detalhes?.tenteNovamenteEmSegundos) {
      res.set('Retry-After', String(conhecido.detalhes.tenteNovamenteEmSegundos));
    }
    return res.status(conhecido.status).json({ erro: corpo });
  }

  // Erros gerados pelo leitor de JSON do Express
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: { codigo: 'JSON_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido.' } });
  }
  // Multipart malformado (corpo cortado, boundary errado...)
  if (/Multipart|Unexpected end of form|Malformed part header/i.test(erro.message || '')) {
    return res.status(400).json({ erro: { codigo: 'FORMULARIO_INVALIDO', mensagem: 'O formulário enviado está incompleto ou malformado.' } });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: { codigo: 'CORPO_MUITO_GRANDE', mensagem: 'O corpo da requisição é grande demais.' } });
  }

  console.error(`[erro] ${req.method} ${req.originalUrl}`, erro);
  return res.status(500).json({ erro: { codigo: 'ERRO_INTERNO', mensagem: 'Ocorreu um erro interno. Tente novamente.' } });
}

module.exports = { rotaNaoEncontrada, tratarErros };
