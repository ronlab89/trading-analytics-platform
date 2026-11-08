import { describe, expect, it } from "vitest";
import { exchangeLabel } from "./exchange-label";

describe("exchangeLabel", () => {
  it("names the exchanges whose code is not how people write them", () => {
    expect(exchangeLabel("NYSEARCA")).toBe("NYSE Arca");
    expect(exchangeLabel("CRYPTO")).toBe("Global");
  });

  it("leaves a code that is already the name as it is", () => {
    expect(exchangeLabel("NASDAQ")).toBe("NASDAQ");
    expect(exchangeLabel("NYSE")).toBe("NYSE");
  });

  it("leaves an unknown code as it is instead of hiding it", () => {
    expect(exchangeLabel("MOCK")).toBe("MOCK");
  });
});
