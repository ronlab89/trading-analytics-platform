const UNKNOWN = "?";

/** The first letter of the first and the last word of the name, in capitals: "Jane Doe" is "JD". */
export function userInitials(displayName: string): string {
  const words = displayName.split(/\s+/).filter((word) => word.length > 0);
  const first = words.at(0);
  const last = words.at(-1);
  if (first === undefined || last === undefined) return UNKNOWN;

  const initial = (word: string) => String.fromCodePoint(word.codePointAt(0) ?? 0).toUpperCase();
  return first === last && words.length === 1 ? initial(first) : initial(first) + initial(last);
}
