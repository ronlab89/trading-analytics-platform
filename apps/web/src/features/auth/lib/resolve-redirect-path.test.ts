import { describe, expect, it } from "vitest";
import { resolveRedirectPath } from "./resolve-redirect-path";

describe("resolveRedirectPath", () => {
  it.each(["/portfolios", "/portfolios/42?tab=positions#top", "/"])(
    "keeps the internal path %s",
    (path) => {
      expect(resolveRedirectPath({ from: path })).toBe(path);
    },
  );

  it.each([
    ["an absolute URL", "https://evil.example/steal"],
    ["a protocol-relative URL", "//evil.example"],
    ["a backslash trick", "/\\evil.example"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a relative path", "portfolios"],
    ["a path with a line break", "/portfolios\n//evil.example"],
    ["an empty string", ""],
  ])("falls back to the start for %s", (_name, path) => {
    expect(resolveRedirectPath({ from: path })).toBe("/");
  });

  it.each([null, undefined, 42, {}, { from: 42 }, { from: null }])(
    "falls back to the start for the state %j",
    (state) => {
      expect(resolveRedirectPath(state)).toBe("/");
    },
  );

  it("does not send the user back to the login screen", () => {
    expect(resolveRedirectPath({ from: "/login" })).toBe("/");
    expect(resolveRedirectPath({ from: "/login?x=1" })).toBe("/");
  });
});
