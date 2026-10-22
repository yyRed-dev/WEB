// Validações simples e explícitas (sem biblioteca extra).
// Cada função recebe o valor bruto e devolve { valor } normalizado ou { erro }.
// `validar({...})` junta tudo e lança um erro 400 com a mensagem de cada campo.
const AppError = require('./AppError');
const config = require('../config/env');

const vazio = (v) => v === undefined || v === null || v === '';

/** Texto de uma linha: tira espaços extras. */
function texto(valor, { obrigatorio = true, min = 1, max = 255, nomeCampo }) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatório.` } : { valor: null };
  if (typeof valor !== 'string') return { erro: `${nomeCampo} deve ser um texto.` };
  const limpo = valor.trim().replace(/\s+/g, ' ');
  if (limpo.length < min) return { erro: `${nomeCampo} deve ter pelo menos ${min} caracteres.` };
  if (limpo.length > max) return { erro: `${nomeCampo} deve ter no máximo ${max} caracteres.` };
  return { valor: limpo };
}

/** Texto de várias linhas (descrição): mantém as quebras de linha. */
function textoLongo(valor, { obrigatorio = true, min = 1, max = 5000, nomeCampo }) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatório.` } : { valor: null };
  if (typeof valor !== 'string') return { erro: `${nomeCampo} deve ser um texto.` };
  const limpo = valor.trim();
  if (limpo.length < min) return { erro: `${nomeCampo} deve ter pelo menos ${min} caracteres.` };
  if (limpo.length > max) return { erro: `${nomeCampo} deve ter no máximo ${max} caracteres.` };
  return { valor: limpo };
}

function matricula(valor) {
  if (typeof valor !== 'string' || valor.trim() === '') return { erro: 'Matrícula é obrigatória.' };
  const limpa = valor.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(limpa)) {
    return { erro: 'Matrícula deve ter de 3 a 20 caracteres, apenas letras e números.' };
  }
  return { valor: limpa };
}

/** Aceita número ou texto numérico ("12"), útil para parâmetros de URL. */
function idPositivo(valor, nomeCampo, { obrigatorio = true } = {}) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatório.` } : { valor: null };
  const numero = typeof valor === 'string' && /^\d+$/.test(valor.trim()) ? Number(valor) : valor;
  if (!Number.isInteger(numero) || numero <= 0 || numero > 2147483647) return { erro: `${nomeCampo} inválido.` };
  return { valor: numero };
}

function inteiro(valor, nomeCampo, { obrigatorio = true, min = 1, max = 2147483647 } = {}) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatório.` } : { valor: null };
  const numero = typeof valor === 'string' && /^-?\d+$/.test(valor.trim()) ? Number(valor) : valor;
  if (!Number.isInteger(numero)) return { erro: `${nomeCampo} deve ser um número inteiro.` };
  if (numero < min || numero > max) return { erro: `${nomeCampo} deve estar entre ${min} e ${max}.` };
  return { valor: numero };
}

/** Horas: número > 0, até 999,99 e no máximo 2 casas decimais. */
function horas(valor, nomeCampo, { obrigatorio = true } = {}) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatória.` } : { valor: null };
  const numero = typeof valor === 'string' && /^\d+([.,]\d+)?$/.test(valor.trim())
    ? Number(valor.trim().replace(',', '.'))
    : valor;
  if (typeof numero !== 'number' || !Number.isFinite(numero)) return { erro: `${nomeCampo} deve ser um número.` };
  if (numero <= 0) return { erro: `${nomeCampo} deve ser maior que zero.` };
  if (numero > 999.99) return { erro: `${nomeCampo} deve ser no máximo 999,99.` };
  if (Math.abs(Math.round(numero * 100) - numero * 100) > 1e-9) return { erro: `${nomeCampo} aceita no máximo 2 casas decimais.` };
  return { valor: numero };
}

function url(valor, nomeCampo, { obrigatorio = false, max = 500 } = {}) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatório.` } : { valor: null };
  if (typeof valor !== 'string') return { erro: `${nomeCampo} deve ser um endereço (URL).` };
  const limpo = valor.trim();
  if (limpo.length > max) return { erro: `${nomeCampo} deve ter no máximo ${max} caracteres.` };
  try {
    const u = new URL(limpo);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo');
  } catch {
    return { erro: `${nomeCampo} deve ser um endereço começando com http:// ou https://.` };
  }
  return { valor: limpo };
}

function opcao(valor, opcoes, nomeCampo, { obrigatorio = true } = {}) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatório.` } : { valor: null };
  const normalizado = typeof valor === 'string' ? valor.trim().toUpperCase() : valor;
  if (!opcoes.includes(normalizado)) return { erro: `${nomeCampo} deve ser: ${opcoes.join(', ')}.` };
  return { valor: normalizado };
}

/**
 * Data e hora. Aceita ISO com fuso ("2026-11-10T14:00:00Z", "...-03:00")
 * ou sem fuso ("2026-11-10T14:00"), que é lido no FUSO_HORARIO configurado.
 */
function dataHora(valor, nomeCampo, { obrigatorio = true } = {}) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatória.` } : { valor: null };
  if (typeof valor !== 'string') return { erro: `${nomeCampo} deve ser uma data e hora (ex.: 2026-11-10T14:00).` };
  const m = valor.trim().match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/);
  if (!m) return { erro: `${nomeCampo} deve ser uma data e hora (ex.: 2026-11-10T14:00).` };
  const texto = `${m[1]}T${m[2]}${m[3] || ':00'}${m[5] || config.fusoHorario}`;
  const data = new Date(texto);
  if (Number.isNaN(data.getTime()) || !dataDoCalendarioValida(m[1])) return { erro: `${nomeCampo} não é uma data válida.` };
  return { valor: data };
}

/**
 * Data sem hora ("2026-11-10"). `fimDoDia: true` devolve 23:59:59.999 daquele dia,
 * para filtros "até tal dia" incluírem o dia inteiro. Lida no FUSO_HORARIO.
 */
function dataDia(valor, nomeCampo, { obrigatorio = false, fimDoDia = false } = {}) {
  if (vazio(valor)) return obrigatorio ? { erro: `${nomeCampo} é obrigatória.` } : { valor: null };
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor.trim()) || !dataDoCalendarioValida(valor.trim())) {
    return { erro: `${nomeCampo} deve ser uma data no formato AAAA-MM-DD.` };
  }
  const hora = fimDoDia ? 'T23:59:59.999' : 'T00:00:00.000';
  return { valor: new Date(`${valor.trim()}${hora}${config.fusoHorario}`) };
}

function dataDoCalendarioValida(aaaaMmDd) {
  const [a, m, d] = aaaaMmDd.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

/** "true"/"false" (query string) ou boolean. */
function booleano(valor, nomeCampo, { padrao = false } = {}) {
  if (vazio(valor)) return { valor: padrao };
  if (valor === true || valor === 'true' || valor === '1') return { valor: true };
  if (valor === false || valor === 'false' || valor === '0') return { valor: false };
  return { erro: `${nomeCampo} deve ser true ou false.` };
}

/** Lista de ids sem repetição. */
function listaIds(valor, nomeCampo, { max = 50 } = {}) {
  if (vazio(valor)) return { valor: [] };
  if (!Array.isArray(valor)) return { erro: `${nomeCampo} deve ser uma lista de ids.` };
  if (valor.length > max) return { erro: `${nomeCampo} aceita no máximo ${max} itens.` };
  const ids = [];
  for (const item of valor) {
    const r = idPositivo(item, nomeCampo);
    if (r.erro) return { erro: `${nomeCampo} contém um id inválido.` };
    if (!ids.includes(r.valor)) ids.push(r.valor);
  }
  return { valor: ids };
}

/**
 * Junta as validações. Se houver erro, lança AppError 400 com { campos: { nome: mensagem } }.
 * Campos cujo resultado é `undefined` são ignorados (útil em atualizações parciais).
 */
function validar(resultados) {
  const campos = {};
  const dados = {};
  for (const [campo, r] of Object.entries(resultados)) {
    if (r === undefined) continue;
    if (r.erro) campos[campo] = r.erro;
    else dados[campo] = r.valor;
  }
  if (Object.keys(campos).length > 0) {
    throw new AppError(400, 'DADOS_INVALIDOS', 'Verifique os dados enviados.', { campos });
  }
  return dados;
}

/** Lança 400 com um único campo (para regras que dependem de vários campos). */
function erroDeCampo(campo, mensagem) {
  return new AppError(400, 'DADOS_INVALIDOS', 'Verifique os dados enviados.', { campos: { [campo]: mensagem } });
}

/** Garante que o corpo é um objeto JSON (e não lista, texto, vazio...). */
function exigirObjeto(corpo) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new AppError(400, 'CORPO_INVALIDO', 'Envie os dados em JSON (Content-Type: application/json).');
  }
  return corpo;
}

module.exports = {
  texto, textoLongo, matricula, idPositivo, inteiro, horas, url, opcao, dataHora, dataDia,
  booleano, listaIds, validar, erroDeCampo, exigirObjeto,
};
