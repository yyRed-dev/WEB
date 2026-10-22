// Lê as variáveis de ambiente (.env) num lugar só e aplica valores padrão.
// A conexão com o banco (DATABASE_URL) é lida diretamente pelo Prisma.
require('dotenv').config({ quiet: true });

function inteiro(nome, padrao, { min, max } = {}) {
  const bruto = process.env[nome];
  const valor = bruto === undefined || bruto === '' ? padrao : Number(bruto);
  if (!Number.isInteger(valor)) throw new Error(`Variável ${nome} deve ser um número inteiro.`);
  if (min !== undefined && valor < min) throw new Error(`Variável ${nome} deve ser >= ${min}.`);
  if (max !== undefined && valor > max) throw new Error(`Variável ${nome} deve ser <= ${max}.`);
  return valor;
}

const ambiente = process.env.NODE_ENV || 'development';
const producao = ambiente === 'production';

const MODOS_IDENTIFICACAO = ['cabecalho', 'nenhum'];
const modoIdentificacao = (process.env.IDENTIFICACAO_MODO || (producao ? 'nenhum' : 'cabecalho')).toLowerCase();
if (!MODOS_IDENTIFICACAO.includes(modoIdentificacao)) {
  throw new Error(`IDENTIFICACAO_MODO inválido: use ${MODOS_IDENTIFICACAO.join(' ou ')}.`);
}
if (producao && modoIdentificacao === 'cabecalho') {
  // O cabeçalho X-Matricula pode ser enviado por qualquer pessoa: só serve para testes.
  throw new Error('IDENTIFICACAO_MODO=cabecalho não é permitido em produção. Aguarde a integração com a Unifor.');
}

const fuso = process.env.FUSO_HORARIO || '-03:00';
if (!/^[+-]\d{2}:\d{2}$/.test(fuso)) throw new Error('FUSO_HORARIO deve ter o formato -03:00.');

const config = {
  ambiente,
  producao,
  porta: inteiro('PORT', 3000, { min: 1, max: 65535 }),
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  fusoHorario: fuso,
  identificacao: { modo: modoIdentificacao },
};

module.exports = config;
