import { describe, expect, it } from "vitest";
import { checkImportFile, IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "./check-import-file";

const HEADER = "symbol,type,quantity,price,executedAt";
const ROW = "AAPL,BUY,10,150.25,2026-01-05";
const csv = (...lines: string[]) => lines.join("\n");
const check = (text: string) => checkImportFile(text, new TextEncoder().encode(text).length);

describe("checkImportFile", () => {
  it("accepts a file with the required columns and counts its data rows", () => {
    expect(check(csv(HEADER, ROW, ROW))).toEqual({ ok: true, rows: 2 });
  });

  it("accepts the optional fees column, in any order, with a BOM and CRLF line ends", () => {
    const text = "﻿fees,executedAt,price,quantity,type,symbol\r\n1,2026-01-05,150,10,BUY,AAPL\r\n";
    expect(check(text)).toEqual({ ok: true, rows: 1 });
  });

  it("does not count blank lines as rows", () => {
    expect(check(csv(HEADER, "", ROW, "  ", ""))).toEqual({ ok: true, rows: 1 });
  });

  it("refuses a file over the byte limit, counted in bytes and not in characters", () => {
    expect(checkImportFile(csv(HEADER, ROW), IMPORT_MAX_BYTES + 1)).toEqual({
      ok: false,
      problem: { kind: "too-large", maxBytes: IMPORT_MAX_BYTES },
    });
    expect(checkImportFile(csv(HEADER, ROW), IMPORT_MAX_BYTES).ok).toBe(true);
  });

  it("refuses an empty file and a file with a header only", () => {
    expect(check("")).toEqual({ ok: false, problem: { kind: "empty" } });
    expect(check(HEADER)).toEqual({ ok: false, problem: { kind: "empty" } });
  });

  it("names the required columns that are missing", () => {
    expect(check(csv("symbol,type,quantity", ROW))).toEqual({
      ok: false,
      problem: { kind: "missing-columns", columns: ["price", "executedAt"] },
    });
  });

  it("names the columns the API does not know", () => {
    expect(check(csv(`${HEADER},note,broker`, `${ROW},a,b`))).toEqual({
      ok: false,
      problem: { kind: "unknown-columns", columns: ["note", "broker"] },
    });
  });

  it("accepts the row limit and refuses one row more", () => {
    const rows = (n: number) => csv(HEADER, ...Array<string>(n).fill(ROW));
    expect(check(rows(IMPORT_MAX_ROWS))).toEqual({ ok: true, rows: IMPORT_MAX_ROWS });
    expect(check(rows(IMPORT_MAX_ROWS + 1))).toEqual({
      ok: false,
      problem: { kind: "too-many-rows", maxRows: IMPORT_MAX_ROWS },
    });
  });

  it("reports the first problem in the API's order: size, header, then rows", () => {
    expect(checkImportFile(csv("symbol", ROW), IMPORT_MAX_BYTES + 1)).toMatchObject({
      problem: { kind: "too-large" },
    });
    expect(check(csv("symbol,extra", ROW))).toMatchObject({ problem: { kind: "missing-columns" } });
  });
});
