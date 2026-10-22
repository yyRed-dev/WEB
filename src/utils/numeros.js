// Conversões numéricas.
//
// O Prisma devolve colunas DECIMAL como objetos `Decimal` (que viram TEXTO
// no JSON, ex.: "10"). Antes de responder, convertemos para número.
// Para somar horas sem erros de arredondamento (0.1 + 0.2 = 0.30000000000000004),
// trabalhamos em CENTÉSIMOS de hora (inteiros) e só no fim voltamos para horas.

/** Decimal | number | string | null -> number | null */
function paraNumero(valor) {
  if (valor === null || valor === undefined) return null;
  return Number(valor);
}

/** horas (ex.: 1.5) -> centésimos inteiros (150) */
function emCentesimos(valor) {
  if (valor === null || valor === undefined) return 0;
  return Math.round(Number(valor) * 100);
}

/** centésimos (150) -> horas (1.5) */
function deCentesimos(centesimos) {
  return centesimos / 100;
}

/** Arredonda para 1 casa decimal (usado em percentuais: 62.5). */
function umaCasa(valor) {
  return Math.round(valor * 10) / 10;
}

module.exports = { paraNumero, emCentesimos, deCentesimos, umaCasa };
