const authService = require('../services/authService');

async function cadastrar(req, res) {
  const usuario = await authService.cadastrarAluno(req.body);
  res.status(201).json({ usuario });
}

async function login(req, res) {
  res.json(await authService.login(req.body, req.ip));
}

module.exports = { cadastrar, login };
