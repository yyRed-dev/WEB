const submissaoService = require('../services/submissaoService');

async function criar(req, res) {
  const submissao = await submissaoService.criar(req.body, req.file, req.usuario, req);
  res.status(201).location(`/api/submissoes/${submissao.id}`).json({ submissao });
}

async function minhas(req, res) {
  res.json(await submissaoService.listarDoAluno(req.query, req.usuario, req));
}

async function painel(req, res) {
  res.json(await submissaoService.listarParaCoordenador(req.query, req.usuario, req));
}

async function detalhar(req, res) {
  res.json({ submissao: await submissaoService.detalhar(req.params.id, req.usuario, req) });
}

async function aprovar(req, res) {
  res.json(await submissaoService.aprovar(req.params.id, req.body, req.usuario, req));
}

async function rejeitar(req, res) {
  res.json(await submissaoService.rejeitar(req.params.id, req.body, req.usuario, req));
}

/** Abre o certificado no navegador (PDF/imagem). */
async function arquivo(req, res) {
  const { caminho, tipo, nomeOriginal } = await submissaoService.arquivoDoComprovante(req.params.id, req.query, req.usuario);
  const seguro = nomeOriginal.replace(/[^\w.\- ]/g, '_');
  res.set('Content-Type', tipo);
  res.set('Content-Disposition', `inline; filename="${seguro}"; filename*=UTF-8''${encodeURIComponent(nomeOriginal)}`);
  res.set('Cache-Control', 'private, no-store');
  await new Promise((resolve, reject) => {
    res.sendFile(caminho, { headers: { 'Content-Type': tipo } }, (erro) => (erro ? reject(erro) : resolve()));
  }).catch((erro) => {
    if (erro.code === 'ENOENT') {
      const AppError = require('../utils/AppError');
      throw new AppError(404, 'ARQUIVO_INDISPONIVEL', 'O arquivo deste certificado não foi encontrado no servidor.');
    }
    throw erro;
  });
}

module.exports = { criar, minhas, painel, detalhar, aprovar, rejeitar, arquivo };
