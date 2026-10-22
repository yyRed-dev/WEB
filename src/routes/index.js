// Todas as rotas da API, montadas sob o prefixo /api (ver app.js).
const { Router } = require('express');
const prisma = require('../config/prisma');
const { identificarUsuario, exigirUsuario, autorizar } = require('../middlewares/identificacao');
const { PERFIS, PODEM_GERENCIAR_ATIVIDADES } = require('../config/perfis');
const atividades = require('../controllers/atividadeController');
const catalogo = require('../controllers/catalogoController');
const progresso = require('../controllers/progressoController');

const router = Router();

// ----- Saúde (não depende de identificação) -----
router.get('/saude', async (_req, res) => {
  let banco = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    banco = 'indisponivel';
  }
  res.status(banco === 'ok' ? 200 : 503).json({ status: banco === 'ok' ? 'ok' : 'degradado', banco });
});

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

// ----- Progresso de horas -----
router.get('/progresso', autorizar(PERFIS.ALUNO), progresso.meu);
router.get('/progresso/:matricula', autorizar(PERFIS.ALUNO, PERFIS.COORDENADOR, PERFIS.ADMINISTRADOR), progresso.porMatricula);

module.exports = router;
