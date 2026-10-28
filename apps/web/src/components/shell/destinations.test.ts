import { describe, expect, it } from "vitest";
import { resources } from "@/i18n/resources";
import { activeDestinationPath, DESTINATIONS, SETTINGS_DESTINATION } from "./destinations";

const all = [...DESTINATIONS, SETTINGS_DESTINATION];

describe("shell destinations", () => {
  it("has the seven views of the activity bar plus settings", () => {
    expect(DESTINATIONS).toHaveLength(7);
    expect(SETTINGS_DESTINATION.path).toBe("/settings");
  });

  it("gives every destination a distinct absolute path", () => {
    const paths = all.map((destination) => destination.path);

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((path) => path.startsWith("/"))).toBe(true);
  });

  it.each(["en", "es"] as const)("has a %s label for every destination", (language) => {
    const nav: Record<string, string> = resources[language].translation.nav;

    for (const destination of all) {
      expect(nav[destination.labelKey.replace("nav.", "")]).toBeTruthy();
    }
  });
});

describe("activeDestinationPath", () => {
  it.each([
    ["/", "/"],
    ["/portfolios", "/portfolios"],
    ["/portfolios/42", "/portfolios"],
    ["/settings", "/settings"],
  ])("marks the view that owns %s", (pathname, expected) => {
    expect(activeDestinationPath(pathname)).toBe(expected);
  });

  it.each(["/does-not-exist", "/portfolios-old"])("leaves Home marked on %s", (pathname) => {
    expect(activeDestinationPath(pathname)).toBe("/");
  });
});
