import { describe, expect, it } from "vitest";
import { checkImportFile } from "./check-import-file";
import { importTemplate } from "./import-template";

describe("importTemplate", () => {
  it("passes the check the dialog applies to a chosen file", () => {
    const text = importTemplate();
    expect(checkImportFile(text, new TextEncoder().encode(text).length)).toEqual({
      ok: true,
      rows: 2,
    });
  });

  it("lists every column of the contract in its header", () => {
    expect(importTemplate().split("\n")[0]).toBe("symbol,type,quantity,price,fees,executedAt");
  });

  it("shows a purchase and a sale, with and without a fee and a time", () => {
    const [, buy, sell] = importTemplate().split("\n");
    expect(buy).toBe("AAPL,BUY,10,150.25,1.00,2026-01-05");
    expect(sell).toBe("AAPL,SELL,4,171.80,,2026-02-12T15:30:00Z");
  });
});
