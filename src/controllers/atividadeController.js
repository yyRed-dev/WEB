// Controladores: recebem a requisição, chamam o serviço e montam a resposta.
const atividadeService = require('../services/atividadeService');

async function listar(req, res) {
  res.json(await atividadeService.listar(req.query, req.usuario));
}

async function detalhar(req, res) {
  res.json({ atividade: await atividadeService.detalhar(req.params.id, req.usuario) });
}

async function criar(req, res) {
  const atividade = await atividadeService.criar(req.body, req.usuario);
  res.status(201).location(`/api/atividades/${atividade.id}`).json({ atividade });
}

async function atualizar(req, res) {
  res.json({ atividade: await atividadeService.atualizar(req.params.id, req.body, req.usuario) });
}

async function cancelar(req, res) {
  res.json({ atividade: await atividadeService.cancelar(req.params.id, req.body, req.usuario) });
}

module.exports = { listar, detalhar, criar, atualizar, cancelar };
