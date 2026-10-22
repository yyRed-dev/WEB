const progressoService = require('../services/progressoService');

async function meu(req, res) {
  res.json(await progressoService.meuProgresso(req.usuario));
}

async function porMatricula(req, res) {
  res.json(await progressoService.progressoPorMatricula(req.params.matricula, req.usuario));
}

module.exports = { meu, porMatricula };
