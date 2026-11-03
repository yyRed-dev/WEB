// Lê as variáveis de ambiente (.env) num lugar só e aplica valores padrão.
// A conexão com o banco (DATABASE_URL) é lida diretamente pelo Prisma.
require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const path = require('node:path');

function inteiro(nome, padrao, { min, max } = {}) {
  const bruto = process.env[nome];
  const valor = bruto === undefined || bruto === '' ? padrao : Number(bruto);
  if (!Number.isInteger(valor)) throw new Error(`Variável ${nome} deve ser um número inteiro.`);
  if (min !== undefined && valor < min) throw new Error(`Variável ${nome} deve ser >= ${min}.`);
  if (max !== undefined && valor > max) throw new Error(`Variável ${nome} deve ser <= ${max}.`);
  return valor;
}

function booleano(nome, padrao) {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto === '') return padrao;
  return ['true', '1', 'sim', 'yes'].includes(bruto.toLowerCase());
}

const ambiente = process.env.NODE_ENV || 'development';
const producao = ambiente === 'production';

// ----- Identificação do usuário (decisão do grupo: só X-Matricula, sem token) -----
//   cabecalho -> o usuário é a matrícula (a mesma da Unifor) do cabeçalho X-Matricula  [padrão]
//   nenhum    -> ninguém é identificado; só as rotas públicas funcionam
const MODOS_IDENTIFICACAO = ['cabecalho', 'nenhum'];
const modoIdentificacao = (process.env.IDENTIFICACAO_MODO || 'cabecalho').toLowerCase();
if (!MODOS_IDENTIFICACAO.includes(modoIdentificacao)) {
  throw new Error(`IDENTIFICACAO_MODO inválido: use ${MODOS_IDENTIFICACAO.join(' ou ')}.`);
}

const fuso = process.env.FUSO_HORARIO || '-03:00';
if (!/^[+-]\d{2}:\d{2}$/.test(fuso)) throw new Error('FUSO_HORARIO deve ter o formato -03:00.');

// ----- Links assinados dos certificados -----
// Segredo usado para assinar os links de download. Em produção é obrigatório
// (senão os links mudariam a cada reinício). Em desenvolvimento, sem valor,
// é gerado um aleatório a cada vez que a API sobe.
let segredoArquivos = process.env.ARQUIVOS_SEGREDO || '';
if (!segredoArquivos) {
  if (producao) throw new Error('Defina ARQUIVOS_SEGREDO (texto aleatório longo) em produção.');
  segredoArquivos = crypto.randomBytes(32).toString('hex');
}
if (segredoArquivos.length < 32) throw new Error('ARQUIVOS_SEGREDO deve ter pelo menos 32 caracteres.');

const config = {
  ambiente,
  producao,
  porta: inteiro('PORT', 3000, { min: 1, max: 65535 }),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  fusoHorario: fuso,
  // Endereço público da API, usado para montar links absolutos (ex.: https://portal.exemplo.edu).
  // Vazio = usa o endereço da própria requisição.
  urlPublica: (process.env.API_URL_PUBLICA || '').replace(/\/+$/, ''),

  identificacao: { modo: modoIdentificacao },

  auth: {
    // Mínimo 4 só existe para os testes rodarem rápido; o padrão é 12.
    bcryptRounds: inteiro('BCRYPT_ROUNDS', 12, { min: 4, max: 15 }),
    cadastroPublico: booleano('CADASTRO_PUBLICO_HABILITADO', true),
    loginMaxTentativas: inteiro('LOGIN_MAX_TENTATIVAS', 5, { min: 1 }),
    loginJanelaMinutos: inteiro('LOGIN_JANELA_MINUTOS', 15, { min: 1 }),
  },

  arquivos: {
    pasta: path.resolve(process.env.UPLOADS_DIR || 'uploads'),
    tamanhoMaximoBytes: inteiro('ARQUIVO_TAMANHO_MAXIMO_MB', 10, { min: 1, max: 50 }) * 1024 * 1024,
    segredo: segredoArquivos,
    validadeLinkMinutos: inteiro('LINK_ARQUIVO_VALIDADE_MINUTOS', 60, { min: 1, max: 24 * 60 }),
  },
};

if (producao && config.auth.bcryptRounds < 10) {
  throw new Error('Em produção, BCRYPT_ROUNDS deve ser no mínimo 10.');
}

module.exports = config;
