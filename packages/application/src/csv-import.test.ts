import { describe, expect, it } from "vitest";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS, parseImportCsv } from "./csv-import.js";
import type { CsvTokenizer } from "./csv-import.js";

/** Splits on commas and newlines only; quoting, BOM and CRLF are the real tokenizer's job. */
const tokenize: CsvTokenizer = (input) => ({
  records: input
    .split("\n")
    .map((text, index) => ({ line: index + 1, values: text.split(",").map((v) => v.trim()) }))
    .filter((record) => !(record.values.length === 1 && record.values[0] === "")),
  malformedLines: [],
});

const parse = (input: string) => parseImportCsv(input, tokenize);

const HEADER = "symbol,type,quantity,price,fees,executedAt";

function csv(...lines: string[]): string {
  return [HEADER, ...lines].join("\n");
}

describe("parseImportCsv: rows", () => {
  it("parses a valid file into rows numbered as an editor shows them", () => {
    const result = parse(
      csv("aapl,buy,10,150.25,1.5,2026-01-05", "MSFT,SELL,2.5,300,,2026-02-01T10:30:00Z"),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        row: 2,
        symbol: "AAPL",
        type: "BUY",
        quantity: 10,
        price: "150.25",
        fees: "1.5",
        executedAt: new Date("2026-01-05T00:00:00Z"),
      },
      {
        row: 3,
        symbol: "MSFT",
        type: "SELL",
        quantity: 2.5,
        price: "300",
        fees: null,
        executedAt: new Date("2026-02-01T10:30:00Z"),
      },
    ]);
  });

  it("accepts the columns in any order and a missing fees column", () => {
    const result = parse(
      ["executedAt,price,quantity,type,symbol", "2026-01-05,10.5,3,BUY,AAPL"].join(
        String.fromCharCode(10),
      ),
    );

    expect(result.errors).toEqual([]);
    expect(result.rows).toMatchObject([{ row: 2, symbol: "AAPL", price: "10.5", fees: null }]);
  });

  it("skips blank lines but keeps the row numbers of the file", () => {
    const result = parse(csv("", "AAPL,BUY,1,10,,2026-01-05", "", "AAPL,BUY,x,10,,2026-01-06"));

    expect(result.rows.map((row) => row.row)).toEqual([3]);
    expect(result.errors.map((error) => error.row)).toEqual([5]);
  });
});

describe("parseImportCsv: row errors", () => {
  it("reports every problem of every bad row with its row and keeps the good rows", () => {
    const result = parse(
      csv("AAPL,BUY,10,150,,2026-01-05", "AAPL,HOLD,0,-1,-2,not-a-date", ",BUY,1,1,,2026-01-05"),
    );

    expect(result.rows.map((row) => row.row)).toEqual([2]);
    expect(result.errors).toEqual([
      { row: 3, message: "The type must be BUY or SELL." },
      { row: 3, message: "The quantity must be a positive number with up to 8 decimals." },
      { row: 3, message: "The price must be a positive number with up to 8 decimals." },
      { row: 3, message: "The fees must be zero or more, with up to 8 decimals." },
      {
        row: 3,
        message: "The executedAt must be YYYY-MM-DD or an ISO 8601 date and time with a zone.",
      },
      { row: 4, message: "The symbol is required." },
    ]);
  });

  it.each([
    ["1e3", "scientific notation"],
    ["1_000", "a digit separator"],
    ["0", "zero"],
    ["1.123456789", "more than 8 decimals"],
    ["-5", "a negative"],
  ])("rejects the quantity %s (%s)", (quantity) => {
    const result = parse(csv(`AAPL,BUY,${quantity},10,,2026-01-05`));

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual([
      { row: 2, message: "The quantity must be a positive number with up to 8 decimals." },
    ]);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-01-05T10:00:00", "05/01/2026", "2026-01-05 10:00"])(
    "rejects the date %s",
    (date) => {
      const result = parse(csv(`AAPL,BUY,1,10,,${date}`));

      expect(result.rows).toEqual([]);
      expect(result.errors).toHaveLength(1);
    },
  );

  it("reports a record the tokenizer could not read, with its line", () => {
    const result = parseImportCsv(csv("AAPL,BUY,1,10,,2026-01-05"), (input) => ({
      ...tokenize(input),
      malformedLines: [3],
    }));

    expect(result.rows.map((row) => row.row)).toEqual([2]);
    expect(result.errors).toEqual([
      { row: 3, message: "The row is not valid CSV or has the wrong number of columns." },
    ]);
  });

  it("rejects a file the tokenizer cannot read at all", () => {
    expect(
      parseImportCsv("x", () => {
        throw new Error("boom");
      }).errors,
    ).toEqual([{ row: 0, message: "The file is not valid CSV." }]);
  });

  it("reports a row with the wrong number of columns", () => {
    const result = parse(csv("AAPL,BUY,1,10", "AAPL,BUY,1,10,,2026-01-05"));

    expect(result.errors).toEqual([
      { row: 2, message: "The row is not valid CSV or has the wrong number of columns." },
    ]);
    expect(result.rows.map((row) => row.row)).toEqual([3]);
  });
});

describe("parseImportCsv: the file", () => {
  it("rejects a header without a required column", () => {
    expect(parse("symbol,type,quantity,price\nAAPL,BUY,1,10")).toEqual({
      rows: [],
      errors: [{ row: 0, message: "The header is missing: executedAt." }],
    });
  });

  it("rejects an unknown column", () => {
    expect(parse(`${HEADER},notes\nAAPL,BUY,1,10,,2026-01-05,hi`).errors).toEqual([
      { row: 0, message: "The header has unknown columns: notes." },
    ]);
  });

  it("rejects an empty file and a file with only a header", () => {
    expect(parse("").errors).toHaveLength(1);
    expect(parse(HEADER).errors).toEqual([{ row: 0, message: "The file has no rows to import." }]);
  });

  it("accepts exactly the row limit and rejects one more", () => {
    const line = "AAPL,BUY,1,10,,2026-01-05";
    const atLimit = csv(...Array.from({ length: IMPORT_MAX_ROWS }, () => line));
    const overLimit = csv(...Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => line));

    expect(parse(atLimit).rows).toHaveLength(IMPORT_MAX_ROWS);
    expect(parse(overLimit)).toEqual({
      rows: [],
      errors: [{ row: 0, message: "The file has more than 5000 rows." }],
    });
  });

  it("rejects a file over the byte limit before parsing it", () => {
    const result = parse("x".repeat(IMPORT_MAX_BYTES + 1));

    expect(result.errors).toEqual([
      { row: 0, message: `The file exceeds the ${IMPORT_MAX_BYTES.toString()}-byte limit.` },
    ]);
  });
});
