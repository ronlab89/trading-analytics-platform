/**
 * The exchanges whose API code is not how people write them. `NYSEARCA` is "NYSE Arca" and
 * `CRYPTO`, the market of the crypto assets, is "Global", as the Figma names them. Any other code
 * (`NASDAQ`, `NYSE`) is already the name.
 */
const EXCHANGE_LABELS: Readonly<Record<string, string>> = {
  NYSEARCA: "NYSE Arca",
  CRYPTO: "Global",
};

/** The name of an exchange as the views show it, from the code the API sends. */
export function exchangeLabel(code: string): string {
  return EXCHANGE_LABELS[code] ?? code;
}
