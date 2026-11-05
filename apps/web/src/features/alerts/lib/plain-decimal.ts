/**
 * A number as plain decimal text: at least cents, and the digits beyond them when it has some, up
 * to eight. `String` would write a tiny number as `1e-7`, which no text box or money format takes.
 */
export function plainDecimal(value: number): string {
  if (Number.isInteger(value * 100)) return value.toFixed(2);
  return value.toFixed(8).replace(/(\.\d*?[1-9])0+$/, "$1");
}
