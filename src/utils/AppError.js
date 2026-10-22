// Erro "esperado" da aplicação: sabemos o código HTTP e a mensagem que o
// cliente deve ver. Qualquer outro erro vira 500 com mensagem genérica.
class AppError extends Error {
  /**
   * @param {number} status   código HTTP (400, 401, 403, 404, 409...)
   * @param {string} codigo   identificador estável para o frontend (ex.: 'MATRICULA_JA_CADASTRADA')
   * @param {string} mensagem texto legível para o usuário
   * @param {object} [detalhes] informações extras (ex.: erros por campo)
   */
  constructor(status, codigo, mensagem, detalhes) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

module.exports = AppError;
