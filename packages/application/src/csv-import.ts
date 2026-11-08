import { TransactionType } from "@trading/domain";
import type { JobRowError } from "@trading/domain";

/**
 * CSV transaction import: the column contract, the limits and the row parser.
 * Source: ADR-008 points 1, 2 and 10, ADR-003 (BUY and SELL only).
 *
 * The file is UTF-8 text with a header row. Columns, in any order:
 *
 * - `symbol` (required): the asset symbol, matched case-insensitively.
 * - `type` (required): `BUY` or `SELL`.
 * - `quantity` (required): a positive number with up to 8 decimals.
 * - `price` (required): the unit price, a positive number with up to 8
 *   decimals, in the portfolio's base currency.
 * - `fees` (optional column, optional value): zero or more, same format.
 * - `executedAt` (required): `YYYY-MM-DD` (midnight UTC) or an ISO 8601 date
 *   and time with an explicit zone, such as `2026-03-01T14:30:00Z`.
 *
 * `row` in a report is the line of the file as an editor shows it: the header
 * is row 1 and the first record is row 2. Row `0` is the file itself.
 *
 * Splitting the text into records is the job of a `CsvTokenizer`: this package
 * may not depend on a parsing library (ADR-001 point 1), so the API wires one
 * (`csv-parse`) at the composition root.
 */
export const IMPORT_MAX_BYTES = 1024 * 1024;
export const IMPORT_MAX_ROWS = 5000;

/** One record of the file, as the cells it holds. `line` is where the record ends. */
export interface RawCsvRecord {
  readonly line: number;
  readonly values: readonly string[];
}

/**
 * The file split into records. Blank lines are already gone and every cell is
 * trimmed. The first record is the header. A record that is not valid CSV
 * (for example an unclosed quote) is not in `records`; its line is in `malformedLines`.
 */
export interface RawCsv {
  readonly records: readonly RawCsvRecord[];
  readonly malformedLines: readonly number[];
}

/** Splits CSV text into records. Throws when the file cannot be read as CSV at all. */
export type CsvTokenizer = (input: string) => RawCsv;

const REQUIRED_COLUMNS = ["symbol", "type", "quantity", "price", "executedAt"] as const;
const KNOWN_COLUMNS: readonly string[] = [...REQUIRED_COLUMNS, "fees"];

const DECIMAL = /^\d{1,12}(\.\d{1,8})?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

const BAD_RECORD = "The row is not valid CSV or has the wrong number of columns.";

/** One CSV record that passed its own checks, before any lookup or business rule. */
export interface ImportRow {
  readonly row: number;
  readonly symbol: string;
  readonly type: TransactionType;
  readonly quantity: number;
  /** A decimal string, kept as text so no precision is lost before `Money`. */
  readonly price: string;
  readonly fees: string | null;
  readonly executedAt: Date;
}

export interface ParsedImport {
  readonly rows: readonly ImportRow[];
  readonly errors: readonly JobRowError[];
}

function fileError(message: string): ParsedImport {
  return { rows: [], errors: [{ row: 0, message }] };
}

function parseExecutedAt(value: string): Date | null {
  if (DATE_ONLY.test(value)) {
    const date = new Date(`${value}T00:00:00Z`);

    // `2026-02-30` must not roll over into March.
    return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
  }

  if (DATE_TIME.test(value)) {
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Checks one record against the column contract; every problem becomes its own entry. */
function parseRecord(
  cells: Readonly<Record<string, string | undefined>>,
  row: number,
): { row: ImportRow } | { problems: JobRowError[] } {
  const problems: JobRowError[] = [];
  const problem = (message: string) => problems.push({ row, message });

  const symbol = (cells.symbol ?? "").toUpperCase();
  if (symbol.length === 0) {
    problem("The symbol is required.");
  }

  const type = (cells.type ?? "").toUpperCase();
  if (type !== TransactionType.BUY && type !== TransactionType.SELL) {
    problem("The type must be BUY or SELL.");
  }

  const quantityText = cells.quantity ?? "";
  const quantity = DECIMAL.test(quantityText) ? Number(quantityText) : Number.NaN;
  if (!(quantity > 0)) {
    problem("The quantity must be a positive number with up to 8 decimals.");
  }

  const price = cells.price ?? "";
  if (!DECIMAL.test(price) || Number(price) <= 0) {
    problem("The price must be a positive number with up to 8 decimals.");
  }

  const feesText = cells.fees ?? "";
  if (feesText.length > 0 && !DECIMAL.test(feesText)) {
    problem("The fees must be zero or more, with up to 8 decimals.");
  }

  const executedAt = parseExecutedAt(cells.executedAt ?? "");
  if (executedAt === null) {
    problem("The executedAt must be YYYY-MM-DD or an ISO 8601 date and time with a zone.");
  }

  if (problems.length > 0 || executedAt === null) {
    return { problems };
  }

  return {
    row: {
      row,
      symbol,
      type: type as TransactionType,
      quantity,
      price,
      fees: feesText.length > 0 ? feesText : null,
      executedAt,
    },
  };
}

/**
 * Parses the CSV text into rows and reports every record that breaks the
 * column contract, each with its row. It checks only what the file itself can
 * tell; assets, currency, dates against the clock and the position history are
 * the validation stage's.
 */
export function parseImportCsv(input: string, tokenize: CsvTokenizer): ParsedImport {
  if (new TextEncoder().encode(input).length > IMPORT_MAX_BYTES) {
    return fileError(`The file exceeds the ${IMPORT_MAX_BYTES.toString()}-byte limit.`);
  }

  let raw: RawCsv;

  try {
    raw = tokenize(input);
  } catch {
    return fileError("The file is not valid CSV.");
  }

  const [header, ...records] = raw.records;

  if (!header) {
    return fileError("The file has no rows to import.");
  }

  const names = [...header.values];
  const missing = REQUIRED_COLUMNS.filter((name) => !names.includes(name));

  if (missing.length > 0) {
    return fileError(`The header is missing: ${missing.join(", ")}.`);
  }

  const unknown = names.filter((name) => !KNOWN_COLUMNS.includes(name));

  if (unknown.length > 0) {
    return fileError(`The header has unknown columns: ${unknown.join(", ")}.`);
  }

  if (records.length + raw.malformedLines.length > IMPORT_MAX_ROWS) {
    return fileError(`The file has more than ${IMPORT_MAX_ROWS.toString()} rows.`);
  }

  if (records.length + raw.malformedLines.length === 0) {
    return fileError("The file has no rows to import.");
  }

  const rows: ImportRow[] = [];
  const errors: JobRowError[] = raw.malformedLines.map((line) => ({
    row: line,
    message: BAD_RECORD,
  }));

  for (const record of records) {
    if (record.values.length !== names.length) {
      errors.push({ row: record.line, message: BAD_RECORD });
      continue;
    }

    const parsed = parseRecord(
      Object.fromEntries(names.map((name, i) => [name, record.values[i]])),
      record.line,
    );

    if ("row" in parsed) {
      rows.push(parsed.row);
    } else {
      errors.push(...parsed.problems);
    }
  }

  return { rows, errors: errors.sort((a, b) => a.row - b.row) };
}
