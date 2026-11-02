// Todas as rotas da API, montadas sob o prefixo /api (ver app.js).
const { Router } = require('express');
const prisma = require('../config/prisma');
const { identificarUsuario, exigirUsuario, autorizar } = require('../middlewares/identificacao');
const { receberCertificado } = require('../middlewares/upload');
const { PERFIS, PODEM_GERENCIAR_ATIVIDADES } = require('../config/perfis');
const auth = require('../controllers/authController');
const atividades = require('../controllers/atividadeController');
const catalogo = require('../controllers/catalogoController');
const progresso = require('../controllers/progressoController');
const submissoes = require('../controllers/submissaoController');

const { ALUNO, COORDENADOR } = PERFIS;
const router = Router();

// ----- Rotas que não dependem de identificação -----
router.get('/saude', async (_req, res) => {
  let banco = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    banco = 'indisponivel';
  }
  res.status(banco === 'ok' ? 200 : 503).json({ status: banco === 'ok' ? 'ok' : 'degradado', banco });
});
// Login e cadastro ficam ANTES da identificação: uma matrícula antiga guardada
// no navegador não impede ninguém de entrar de novo.
router.post('/auth/login', auth.login);
router.post('/auth/cadastro', auth.cadastrar);

// Daqui em diante, toda requisição passa pela identificação (preenche req.usuario).
router.use(identificarUsuario);

// ----- Usuário identificado -----
router.get('/usuarios/me', exigirUsuario, (req, res) => res.json({ usuario: req.usuario }));

// ----- Listas de apoio (públicas) -----
router.get('/categorias', catalogo.categorias);
router.get('/tipos-atividade', catalogo.tipos);
router.get('/cursos', catalogo.cursos);

// ----- Atividades -----
router.get('/atividades', atividades.listar); // público
router.get('/atividades/:id', atividades.detalhar); // público
router.post('/atividades', autorizar(...PODEM_GERENCIAR_ATIVIDADES), atividades.criar);
router.patch('/atividades/:id', autorizar(...PODEM_GERENCIAR_ATIVIDADES), atividades.atualizar);
router.delete('/atividades/:id', autorizar(...PODEM_GERENCIAR_ATIVIDADES), atividades.cancelar);

// ----- Submissões (certificados) -----
// A permissão é conferida ANTES de receber o arquivo.
router.post('/submissoes', autorizar(ALUNO), receberCertificado, submissoes.criar);
router.get('/submissoes/minhas', autorizar(ALUNO), submissoes.minhas);
router.get('/submissoes', autorizar(COORDENADOR), submissoes.painel);
router.get('/submissoes/:id', autorizar(ALUNO, COORDENADOR), submissoes.detalhar);
router.patch('/submissoes/:id/aprovar', autorizar(COORDENADOR), submissoes.aprovar);
router.patch('/submissoes/:id/rejeitar', autorizar(COORDENADOR), submissoes.rejeitar);
// Abre o arquivo: link assinado (url que vem nas listas) OU usuário com permissão.
router.get('/comprovantes/:id/arquivo', submissoes.arquivo);

// ----- Progresso de horas -----
router.get('/progresso', autorizar(ALUNO), progresso.meu);
router.get('/progresso/:matricula', autorizar(ALUNO, COORDENADOR), progresso.porMatricula);

module.exports = router;
