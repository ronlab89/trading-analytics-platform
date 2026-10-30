import { describe, expect, it } from "vitest";
import { portfolioInitials } from "./portfolio-initials";

describe("portfolioInitials", () => {
  it("takes the first two letters of a single word, as the Figma samples do", () => {
    expect(portfolioInitials("Crecimiento")).toBe("CR");
    expect(portfolioInitials("Conservador")).toBe("CO");
  });

  it("takes the first letter of the first two words of a longer name", () => {
    expect(portfolioInitials("Renta fija")).toBe("RF");
    expect(portfolioInitials("Renta fija global")).toBe("RF");
  });

  it("uppercases and ignores extra whitespace", () => {
    expect(portfolioInitials("  tech   growth ")).toBe("TG");
  });

  it("keeps one letter for a one-letter name and a placeholder for an empty one", () => {
    expect(portfolioInitials("x")).toBe("X");
    expect(portfolioInitials("   ")).toBe("?");
  });

  it("does not split a character outside the basic plane in half", () => {
    expect(portfolioInitials("😀Fun")).toBe("😀F");
  });
});
