import { parseImportCsv } from "@trading/application";
import { describe, expect, it } from "vitest";
import { tokenizeCsv } from "./csv-tokenizer";

const BOM = String.fromCodePoint(0xfeff);
const HEADER = "symbol,type,quantity,price,fees,executedAt";
const BAD_ROW = "The row is not valid CSV or has the wrong number of columns.";

// The first four cases are the ones of apps/api/src/import/csv-tokenizer.test.ts.
describe("tokenizeCsv", () => {
  it("drops the BOM, accepts CRLF and unquotes fields", () => {
    expect(tokenizeCsv(`${BOM}symbol,price\r\n"AAPL","10.5"\r\n`)).toEqual({
      records: [
        { line: 1, values: ["symbol", "price"] },
        { line: 2, values: ["AAPL", "10.5"] },
      ],
      malformedLines: [],
    });
  });

  it("trims every cell and skips blank lines without losing the line numbers", () => {
    const raw = tokenizeCsv("a,b\n\n 1 , 2 \n\n3,4");

    expect(raw.records.map((record) => [record.line, record.values])).toEqual([
      [1, ["a", "b"]],
      [3, ["1", "2"]],
      [5, ["3", "4"]],
    ]);
  });

  it("keeps a record with the wrong number of cells for the import to judge", () => {
    expect(tokenizeCsv("a,b\n1").records[1]?.values).toEqual(["1"]);
  });

  it("reports an unclosed quote by its line and keeps reading the rest", () => {
    expect(tokenizeCsv('a,b\n1,"2\n3,4').malformedLines.length).toBeGreaterThan(0);
  });

  it("keeps escaped quotes, commas and line breaks inside a quoted field", () => {
    const raw = tokenizeCsv('a,b\n"x ""y"", z","1\n2"\n');

    expect(raw.records[1]).toEqual({ line: 3, values: ['x "y", z', "1\n2"] });
  });

  it("reports a stray quote and reads on from the next line", () => {
    const raw = tokenizeCsv('a,b\n1,x"y\n3,4');

    expect(raw.malformedLines).toEqual([2]);
    expect(raw.records.map((record) => record.values)).toEqual([
      ["a", "b"],
      ["3", "4"],
    ]);
  });
});

describe("parseImportCsv with the browser tokenizer", () => {
  it("parses a file with quotes, CRLF and a BOM", () => {
    const result = parseImportCsv(
      `${BOM}${HEADER}\r\n"aapl",BUY,3,"10.5",,2026-01-05\r\n`,
      tokenizeCsv,
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toMatchObject([{ row: 2, symbol: "AAPL", price: "10.5", fees: null }]);
  });

  it("numbers rows by file line across blank lines", () => {
    const result = parseImportCsv(
      `${HEADER}\n\nAAPL,BUY,1,10,,2026-01-05\n\nAAPL,BUY,x,10,,2026-01-06`,
      tokenizeCsv,
    );

    expect(result.rows.map((row) => row.row)).toEqual([3]);
    expect(result.errors.map((error) => error.row)).toEqual([5]);
  });

  it("reports a short row and still returns the good ones", () => {
    const result = parseImportCsv(
      `${HEADER}\nAAPL,BUY,1,10\nAAPL,BUY,1,10,,2026-01-05`,
      tokenizeCsv,
    );

    expect(result.errors).toEqual([{ row: 2, message: BAD_ROW }]);
    expect(result.rows.map((row) => row.row)).toEqual([3]);
  });

  it("reports an unclosed quote as a bad row instead of failing the file", () => {
    const result = parseImportCsv(
      `${HEADER}\nAAPL,BUY,1,10,,2026-01-05\n"AAPL,BUY,1,10,,2026-01-06`,
      tokenizeCsv,
    );

    expect(result.rows.map((row) => row.row)).toEqual([2]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toBe(BAD_ROW);
  });
});
