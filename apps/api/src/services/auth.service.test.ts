import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getByEmail = vi.fn();
const getByUserId = vi.fn();

vi.mock("@trading/database", () => ({
  PrismaUserRepository: class {
    getByEmail = getByEmail;
    getById = vi.fn();
  },
  PrismaCredentialRepository: class {
    getByUserId = getByUserId;
  },
}));

const { login } = await import("./auth.service.js");

describe("login timing equalization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getByEmail.mockReset();
    getByUserId.mockReset();
  });

  it("runs a bcrypt comparison even when the user does not exist", async () => {
    getByEmail.mockResolvedValue(null);
    const compare = vi.spyOn(bcrypt, "compare");

    await expect(login("ghost@example.com", "whatever")).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials.",
    });

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare).toHaveBeenCalledWith("whatever", expect.stringMatching(/^\$2[aby]\$10\$/));
  });

  it("runs a bcrypt comparison even when the user has no credential", async () => {
    getByEmail.mockResolvedValue({ id: "u1", email: "a@b.c", displayName: "A", role: "USER" });
    getByUserId.mockResolvedValue(null);
    const compare = vi.spyOn(bcrypt, "compare");

    await expect(login("a@b.c", "whatever")).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid credentials.",
    });

    expect(compare).toHaveBeenCalledTimes(1);
  });
});
