// Ponto de entrada: confere o banco e abre a porta HTTP.
const app = require('./app');
const config = require('./config/env');
const prisma = require('./config/prisma');

async function iniciar() {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('Conectado ao MySQL pelo Prisma.');
  } catch (erro) {
    console.error('Não foi possível conectar ao MySQL:', erro.message);
    console.error('Confira DATABASE_URL no .env e se as migrações foram aplicadas (npm run db:migrate).');
    process.exit(1);
  }

  const servidor = app.listen(config.porta, () => {
    console.log(`API rodando em http://localhost:${config.porta}/api (ambiente: ${config.ambiente})`);
    if (config.identificacao.modo === 'cabecalho') {
      console.log('Identificação PROVISÓRIA pelo cabeçalho X-Matricula (somente desenvolvimento).');
    }
  });

  const encerrar = () => {
    servidor.close(() => prisma.$disconnect().finally(() => process.exit(0)));
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

iniciar();
