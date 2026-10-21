import { parse } from "csv-parse/sync";
import type { CsvError } from "csv-parse/sync";
import type { CsvTokenizer } from "@trading/application";

/**
 * Splits CSV text into records with `csv-parse` (ADR-008 point 10, decided in
 * the B4 plan). It drops the BOM and the blank lines, trims every cell, and
 * keeps a record that is not valid CSV out of the result, reporting its line, so
 * the import can name every bad row instead of stopping at the first.
 *
 * A record with a different number of cells than the header is kept: whether
 * that is an error is the import's rule, not the tokenizer's.
 */
export const tokenizeCsv: CsvTokenizer = (input) => {
  const malformedLines: number[] = [];

  const parsed = parse(input, {
    bom: true,
    info: true,
    relax_column_count: true,
    skip_empty_lines: true,
    skip_records_with_error: true,
    on_skip: (error: CsvError | undefined) => {
      malformedLines.push(typeof error?.lines === "number" ? error.lines : 0);

      return undefined;
    },
    trim: true,
  }) as unknown as { record: string[]; info: { lines: number } }[];

  return {
    records: parsed.map(({ record, info }) => ({ line: info.lines, values: record })),
    malformedLines,
  };
};
