export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;

const REQUIRED_COLUMNS = ["symbol", "type", "quantity", "price", "executedAt"];
const KNOWN_COLUMNS = [...REQUIRED_COLUMNS, "fees"];

export type ImportFileProblem =
  | { kind: "too-large"; maxBytes: number }
  | { kind: "empty" }
  | { kind: "missing-columns"; columns: string[] }
  | { kind: "unknown-columns"; columns: string[] }
  | { kind: "too-many-rows"; maxRows: number };

export type ImportFileCheck =
  { ok: true; rows: number } | { ok: false; problem: ImportFileProblem };

const fail = (problem: ImportFileProblem): ImportFileCheck => ({ ok: false, problem });

/**
 * What the browser can tell about a CSV before it is sent: the same file-level limits the API
 * applies (size in bytes, number of data rows, required and unknown columns), in the same order.
 * Row contents are the job's to check; their errors come back in its report. Records are counted
 * by line, as the API's parser reports `row`; a quoted line break would count extra, which only
 * matters at the row limit.
 */
export function checkImportFile(text: string, byteLength: number): ImportFileCheck {
  if (byteLength > IMPORT_MAX_BYTES) return fail({ kind: "too-large", maxBytes: IMPORT_MAX_BYTES });

  const lines = text
    .replace(/^\u{FEFF}/u, "")
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);
  const [header, ...records] = lines;
  if (header === undefined || records.length === 0) return fail({ kind: "empty" });

  const names = header.split(",").map((name) => name.trim());
  const missing = REQUIRED_COLUMNS.filter((name) => !names.includes(name));
  if (missing.length > 0) return fail({ kind: "missing-columns", columns: missing });

  const unknown = names.filter((name) => !KNOWN_COLUMNS.includes(name));
  if (unknown.length > 0) return fail({ kind: "unknown-columns", columns: unknown });

  if (records.length > IMPORT_MAX_ROWS)
    return fail({ kind: "too-many-rows", maxRows: IMPORT_MAX_ROWS });

  return { ok: true, rows: records.length };
}
