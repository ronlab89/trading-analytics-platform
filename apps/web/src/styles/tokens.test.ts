import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), "utf8");

const sources = {
  "index.css": read("index.css"),
  "styles/tokens.css": read("styles/tokens.css"),
  "styles/typography.css": read("styles/typography.css"),
  "styles/effects.css": read("styles/effects.css"),
};

const all = Object.values(sources).join("\n");

const declared = new Set([...all.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((match) => match[1]));

describe("design tokens", () => {
  it("defines every custom property that the stylesheets reference", () => {
    const missing = [...all.matchAll(/var\((--[\w-]+)/g)]
      .map((match) => match[1])
      .filter((name) => !declared.has(name));

    expect([...new Set(missing)]).toEqual([]);
  });

  it("imports every stylesheet from index.css", () => {
    for (const name of ["tokens", "typography", "effects"]) {
      expect(sources["index.css"]).toContain(`@import "./styles/${name}.css"`);
    }
  });

  it("has no dark theme", () => {
    expect(sources["index.css"]).not.toMatch(/\.dark\b|@custom-variant dark/);
  });

  it("keeps the radius scale from Figma instead of the shadcn calc scale", () => {
    expect(sources["index.css"]).not.toMatch(/--radius\s*:/);
    expect(sources["index.css"]).not.toMatch(/--radius-[\w]+:\s*calc\(/);
  });

  it.each(["raised", "popover", "toast", "dialog"])("defines and exposes the %s shadow", (name) => {
    expect(sources["styles/effects.css"]).toContain(`--shadow-${name}:`);
    expect(sources["index.css"]).toContain(`--shadow-${name}: var(--shadow-${name});`);
  });

  it("does not remap the Tailwind size scale with the spacing tokens", () => {
    expect(sources["index.css"]).not.toMatch(/--spacing-\w+\s*:/);
  });

  it("switches layout at the ADR-010 widths, not at the Tailwind defaults", () => {
    expect(sources["index.css"]).toContain("--breakpoint-tablet: 561px;");
    expect(sources["index.css"]).toContain("--breakpoint-desktop: 901px;");
  });
});
