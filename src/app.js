// Monta o aplicativo Express (sem abrir porta: isso fica no server.js,
// o que permite aos testes subir a API numa porta aleatória).
const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const rotas = require('./routes');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/erros');

const app = express();

app.disable('x-powered-by'); // não anuncia que o servidor usa Express

app.use(
  cors({
    origin(origem, callback) {
      // Sem "Origin" = chamada fora do navegador (curl, Postman, testes): liberada.
      if (!origem || config.corsOrigins.includes(origem)) return callback(null, true);
      return callback(null, false); // origem não autorizada: o navegador bloqueia a resposta
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    // X-Matricula: identificação provisória (desenvolvimento). Authorization: reservado para a integração Unifor.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Matricula'],
  }),
);

app.use((_req, res, next) => {
  // Cabeçalhos básicos de segurança para uma API JSON
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'no-store');
  next();
});

app.use(express.json({ limit: '100kb' }));

app.use('/api', rotas);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;
