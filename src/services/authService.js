// Login de teste e cadastro de aluno.
//
// É um login PRÓPRIO do portal, para testes e demonstração enquanto a
// integração com o login da Unifor não existe. Decisão do grupo: SEM token.
// O login só confere matrícula e senha e devolve os dados do usuário; depois
// disso o front identifica o usuário pelo cabeçalho X-Matricula
// (src/middlewares/identificacao.js).
// Boas práticas mantidas: senha só como hash bcrypt, mesma resposta para
// matrícula inexistente e senha errada, limite de tentativas.
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const config = require('../config/env');
const { PERFIS } = require('../config/perfis');
const AppError = require('../utils/AppError');
const v = require('../utils/validacao');
const { paraJson, INCLUIR_CURSO } = require('./usuarioService');
const limiteLogin = require('./limiteLogin');

// Hash "falso": o login demora o mesmo com ou sem usuário, e ninguém descobre
// quais matrículas existem pelo tempo de resposta.
const HASH_FICTICIO = bcrypt.hashSync('senha-que-nao-existe-123', config.auth.bcryptRounds);

function gerarHashSenha(senha) {
  return bcrypt.hash(senha, config.auth.bcryptRounds);
}

/** Traduz UNIQUE violado (inclusive em cadastros simultâneos) para 409. */
function erroDeDuplicidade(erro) {
  if (erro?.code !== 'P2002') return erro;
  if (String(erro.meta?.target ?? '').includes('email')) {
    return new AppError(409, 'EMAIL_JA_CADASTRADO', 'Já existe uma conta com este e-mail.');
  }
  return new AppError(409, 'MATRICULA_JA_CADASTRADA', 'Já existe uma conta com esta matrícula.');
}

/**
 * Cadastro PÚBLICO: cria sempre um ALUNO. Não dá para escolher o perfil.
 * Coordenadores são criados no servidor (npm run usuario:criar).
 */
async function cadastrarAluno(corpo) {
  if (!config.auth.cadastroPublico) {
    throw new AppError(403, 'CADASTRO_DESABILITADO', 'O cadastro de contas está desabilitado.');
  }
  v.exigirObjeto(corpo);
  if (corpo.perfil !== undefined && String(corpo.perfil).toUpperCase() !== PERFIS.ALUNO) {
    throw new AppError(403, 'PERFIL_NAO_PERMITIDO', 'O cadastro cria apenas contas de aluno.');
  }

  const dados = v.validar({
    nome: v.texto(corpo.nome, { min: 3, max: 150, nomeCampo: 'Nome' }),
    matricula: v.matricula(corpo.matricula),
    email: v.email(corpo.email, { obrigatorio: true }),
    senha: v.senhaNova(corpo.senha),
    cursoId: v.idPositivo(corpo.cursoId, 'Curso'),
  });

  const curso = await prisma.curso.findUnique({ where: { id: dados.cursoId } });
  if (!curso || !curso.ativo) throw v.erroDeCampo('cursoId', 'Curso não encontrado ou inativo.');

  if (await prisma.usuario.findUnique({ where: { matricula: dados.matricula } })) {
    throw erroDeDuplicidade({ code: 'P2002', meta: { target: 'matricula' } });
  }
  if (await prisma.usuario.findUnique({ where: { email: dados.email } })) {
    throw erroDeDuplicidade({ code: 'P2002', meta: { target: 'email' } });
  }

  try {
    const usuario = await prisma.usuario.create({
      data: {
        matricula: dados.matricula,
        nome: dados.nome,
        email: dados.email,
        senhaHash: await gerarHashSenha(dados.senha),
        perfil: PERFIS.ALUNO,
        cursoId: dados.cursoId,
      },
      include: INCLUIR_CURSO,
    });
    return paraJson(usuario);
  } catch (erro) {
    throw erroDeDuplicidade(erro);
  }
}

/** Confere matrícula e senha e devolve os dados do usuário (nome, matrícula, perfil, curso). */
async function login(corpo, ip) {
  v.exigirObjeto(corpo);
  const matricula = typeof corpo.matricula === 'string' ? corpo.matricula.trim().toUpperCase() : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
  if (!matricula || !senha) throw new AppError(400, 'DADOS_INVALIDOS', 'Informe matrícula e senha.');

  const chave = `${ip}|${matricula}`;
  const espera = limiteLogin.segundosBloqueado(chave);
  if (espera > 0) {
    throw new AppError(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas de login. Tente novamente em alguns minutos.', {
      tenteNovamenteEmSegundos: espera,
    });
  }

  const conta = /^[A-Z0-9]{3,20}$/.test(matricula)
    ? await prisma.usuario.findUnique({ where: { matricula }, select: { id: true, senhaHash: true, ativo: true } })
    : null;
  // Sempre roda o bcrypt, mesmo sem conta, para o tempo de resposta ser parecido.
  const confere = await bcrypt.compare(senha, conta?.senhaHash || HASH_FICTICIO);

  if (!conta || !conta.senhaHash || !confere || !conta.ativo) {
    limiteLogin.registrarFalha(chave);
    throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'Matrícula ou senha inválidas.');
  }
  limiteLogin.limpar(chave);

  const usuario = await prisma.usuario.findUnique({ where: { id: conta.id }, include: INCLUIR_CURSO });
  return { usuario: paraJson(usuario) };
}

module.exports = { cadastrarAluno, login, gerarHashSenha };
