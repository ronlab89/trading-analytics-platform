const UNKNOWN = "?";

/** Characters, not UTF-16 units, so a letter outside the basic plane is never cut in half. */
const letters = (word: string) => Array.from(word);

/**
 * What the portfolio avatar shows, as the Figma samples do: the first letter of the first two
 * words ("Renta fija" is "RF"), or the first two letters of a single word ("Crecimiento" is "CR").
 */
export function portfolioInitials(name: string): string {
  const [first, second] = name.split(/\s+/).filter((word) => word.length > 0);
  if (first === undefined) return UNKNOWN;

  const initials =
    second === undefined
      ? letters(first).slice(0, 2).join("")
      : (letters(first)[0] ?? "") + (letters(second)[0] ?? "");

  return initials.toUpperCase();
}
