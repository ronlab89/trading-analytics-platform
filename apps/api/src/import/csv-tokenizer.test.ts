import { describe, expect, it } from "vitest";
import { parseImportCsv } from "@trading/application";
import { tokenizeCsv } from "./csv-tokenizer.js";

const BOM = String.fromCodePoint(0xfeff);
const HEADER = "symbol,type,quantity,price,fees,executedAt";

describe("tokenizeCsv", () => {
  it("drops the BOM, accepts CRLF and unquotes fields", () => {
    const raw = tokenizeCsv(`${BOM}symbol,price\r\n"AAPL","10.5"\r\n`);

    expect(raw).toEqual({
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
    const raw = tokenizeCsv('a,b\n1,"2\n3,4');

    expect(raw.malformedLines.length).toBeGreaterThan(0);
  });
});

describe("parseImportCsv with the real tokenizer", () => {
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

    expect(result.errors).toEqual([
      { row: 2, message: "The row is not valid CSV or has the wrong number of columns." },
    ]);
    expect(result.rows.map((row) => row.row)).toEqual([3]);
  });

  it("reports an unclosed quote as a bad row instead of failing the file", () => {
    const result = parseImportCsv(
      `${HEADER}\nAAPL,BUY,1,10,,2026-01-05\n"AAPL,BUY,1,10,,2026-01-06`,
      tokenizeCsv,
    );

    expect(result.rows.map((row) => row.row)).toEqual([2]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toBe(
      "The row is not valid CSV or has the wrong number of columns.",
    );
  });
});
