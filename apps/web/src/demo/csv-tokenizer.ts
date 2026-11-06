import type { CsvTokenizer } from "@trading/application";

const BOM = String.fromCodePoint(0xfeff);

/**
 * Splits CSV text into records, the way `apps/api/src/import/csv-tokenizer.ts` does with `csv-parse`
 * (ADR-008 point 10): it drops the BOM and the blank lines, trims every unquoted cell, and keeps a
 * record that is not valid CSV out of the result, reporting its line, so the import can name every bad
 * row instead of stopping at the first. A record with a different number of cells than the header is
 * kept: whether that is an error is the rule of the import. The browser build avoids the `csv-parse`
 * dependency; `csv-tokenizer.test.ts` runs the cases of the API tokenizer against this one.
 */
export const tokenizeCsv: CsvTokenizer = (input) => {
  const text = (input.startsWith(BOM) ? input.slice(1) : input).replace(/\r\n?/g, "\n");
  const records: { line: number; values: string[] }[] = [];
  const malformedLines: number[] = [];

  let line = 1;
  let values: string[] = [];
  let field = "";
  let quoted = false;
  let inQuotes = false;
  let afterQuote = false;
  let broken = false;

  const endField = () => {
    values.push(quoted ? field : field.trim());
    field = "";
    quoted = false;
    afterQuote = false;
  };

  const endRecord = (endLine: number) => {
    if (broken) {
      malformedLines.push(endLine);
    } else {
      const wasQuoted = quoted;
      endField();
      const blank = !wasQuoted && values.length === 1 && values[0] === "";
      if (!blank) records.push({ line: endLine, values });
    }
    values = [];
    field = "";
    quoted = false;
    afterQuote = false;
    broken = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);

    if (inQuotes) {
      if (char !== '"') {
        field += char;
        if (char === "\n") line += 1;
      } else if (text.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = false;
        afterQuote = true;
      }
    } else if (char === "\n") {
      endRecord(line);
      line += 1;
    } else if (broken) {
      // The rest of the line belongs to the bad record.
    } else if (afterQuote) {
      if (char === ",") endField();
      else if (char !== " " && char !== "\t") broken = true;
    } else if (char === ",") {
      endField();
    } else if (char === '"') {
      if (field.trim() === "" && !quoted) {
        quoted = true;
        inQuotes = true;
        field = "";
      } else {
        broken = true;
      }
    } else {
      field += char;
    }
  }

  if (inQuotes) {
    // The file ends inside a quoted field: that record cannot be read.
    malformedLines.push(line);
  } else if (field !== "" || values.length > 0 || quoted || broken) {
    endRecord(line);
  }

  return { records, malformedLines };
};
