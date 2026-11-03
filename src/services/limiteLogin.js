// Limita tentativas de login erradas para dificultar "chutar" senhas.
// Conta as FALHAS por (IP + matrícula) dentro de uma janela de tempo.
//
// Limitação conhecida: os contadores ficam na memória do processo. Se o
// servidor reiniciar, eles zeram; com várias instâncias, cada uma conta separado.
const config = require('../config/env');

const tentativas = new Map(); // chave -> { falhas, inicio }

const janelaMs = () => config.auth.loginJanelaMinutos * 60 * 1000;

function limparExpiradas(agora) {
  for (const [chave, registro] of tentativas) {
    if (agora - registro.inicio > janelaMs()) tentativas.delete(chave);
  }
}

/** Segundos que faltam para liberar, ou 0 se não estiver bloqueado. */
function segundosBloqueado(chave) {
  const agora = Date.now();
  const registro = tentativas.get(chave);
  if (!registro) return 0;
  if (agora - registro.inicio > janelaMs()) {
    tentativas.delete(chave);
    return 0;
  }
  if (registro.falhas < config.auth.loginMaxTentativas) return 0;
  return Math.ceil((registro.inicio + janelaMs() - agora) / 1000);
}

function registrarFalha(chave) {
  const agora = Date.now();
  if (tentativas.size > 10000) limparExpiradas(agora); // evita crescer sem limite
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.inicio > janelaMs()) tentativas.set(chave, { falhas: 1, inicio: agora });
  else registro.falhas += 1;
}

const limpar = (chave) => tentativas.delete(chave);
const limparTudo = () => tentativas.clear();

module.exports = { segundosBloqueado, registrarFalha, limpar, limparTudo };
