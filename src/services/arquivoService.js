// Armazenamento dos certificados enviados (disco local) e links assinados.
//
// Segurança:
//   * O TIPO REAL do arquivo é conferido pelos primeiros bytes ("assinatura"),
//     não pelo Content-Type nem só pela extensão que o navegador manda.
//   * O nome no disco é aleatório (UUID); o nome original só é guardado no banco.
//   * A pasta de uploads NÃO é servida como estática: o download passa por uma
//     rota que confere permissão ou um link assinado (HMAC) que expira.
//
// Limitação: em produção com mais de um servidor, a pasta precisa ser
// compartilhada (ou trocar este arquivo por um armazenamento externo).
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const config = require('../config/env');

const PASTA = () => path.join(config.arquivos.pasta, 'comprovantes');

const TIPOS = {
  pdf: { mime: 'application/pdf', extensoes: ['.pdf'] },
  png: { mime: 'image/png', extensoes: ['.png'] },
  jpg: { mime: 'image/jpeg', extensoes: ['.jpg', '.jpeg'] },
};

/** Descobre o tipo pelo conteúdo. Devolve { tipo, mime } ou null. */
function detectarTipo(buffer) {
  if (!buffer || buffer.length < 8) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { tipo: 'png', ...TIPOS.png };
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { tipo: 'jpg', ...TIPOS.jpg };
  // PDF: "%PDF-" nos primeiros 1024 bytes (a especificação permite lixo antes)
  if (buffer.subarray(0, 1024).indexOf('%PDF-') !== -1) return { tipo: 'pdf', ...TIPOS.pdf };
  return null;
}

/** A extensão do nome original combina com o conteúdo? */
function extensaoConfere(nomeOriginal, tipoDetectado) {
  const ext = path.extname(nomeOriginal || '').toLowerCase();
  return tipoDetectado.extensoes.includes(ext);
}

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

/** Grava o arquivo com nome aleatório e devolve esse nome. */
async function salvar(buffer, tipoDetectado) {
  const nome = `${crypto.randomUUID()}${tipoDetectado.extensoes[0]}`;
  await fs.mkdir(PASTA(), { recursive: true });
  await fs.writeFile(path.join(PASTA(), nome), buffer, { flag: 'wx' }); // wx: nunca sobrescreve
  return nome;
}

async function remover(nomeArmazenado) {
  await fs.rm(caminhoDe(nomeArmazenado), { force: true });
}

/** Caminho absoluto, garantindo que não sai da pasta de uploads. */
function caminhoDe(nomeArmazenado) {
  if (path.basename(nomeArmazenado) !== nomeArmazenado) throw new Error('Nome de arquivo inválido.');
  return path.join(PASTA(), nomeArmazenado);
}

// ----- Links assinados -----

function assinatura(comprovanteId, expira) {
  return crypto.createHmac('sha256', config.arquivos.segredo).update(`comprovante:${comprovanteId}:${expira}`).digest('base64url');
}

/** Link absoluto para baixar/abrir o certificado sem precisar de cabeçalho de login. */
function urlAssinada(req, comprovanteId) {
  const expira = Math.floor(Date.now() / 1000) + config.arquivos.validadeLinkMinutos * 60;
  const base = config.urlPublica || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/comprovantes/${comprovanteId}/arquivo?expira=${expira}&assinatura=${assinatura(comprovanteId, expira)}`;
}

function assinaturaValida(comprovanteId, expiraBruto, assinaturaBruta) {
  const expira = Number(expiraBruto);
  if (!Number.isInteger(expira) || typeof assinaturaBruta !== 'string') return false;
  if (expira < Math.floor(Date.now() / 1000)) return false;
  const esperada = Buffer.from(assinatura(comprovanteId, expira));
  const recebida = Buffer.from(assinaturaBruta);
  return esperada.length === recebida.length && crypto.timingSafeEqual(esperada, recebida);
}

module.exports = { detectarTipo, extensaoConfere, sha256, salvar, remover, caminhoDe, urlAssinada, assinaturaValida, TIPOS };
