import { describe, expect, it } from "vitest";
import { userInitials } from "./user-initials";

describe("userInitials", () => {
  it.each([
    ["Jane Doe", "JD"],
    ["jane doe", "JD"],
    ["Jane", "J"],
    ["Jane Marie Doe", "JD"],
    ["  Jane   Doe  ", "JD"],
    ["Álvaro Núñez", "ÁN"],
    ["😀 Smile", "😀S"],
  ])("takes the first and last initials of %j: %s", (name, expected) => {
    expect(userInitials(name)).toBe(expected);
  });

  it("falls back to a question mark for a blank name", () => {
    expect(userInitials("")).toBe("?");
    expect(userInitials("   ")).toBe("?");
  });
});
