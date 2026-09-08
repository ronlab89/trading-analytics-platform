import type { UserRole } from "./enums";

/**
 * User entity.
 * Source: docs/05-data-model.md §5
 *
 * This is a pure domain type. It has no dependency on React, Express,
 * or any persistence technology (NFR-042, NFR-043).
 */
export interface User {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CreateUserInput = Omit<User, "id" | "createdAt" | "updatedAt" | "role"> & {
  role?: UserRole;
};

/**
 * Minimal, framework-agnostic email format check.
 *
 * This is intentionally not a full RFC 5322 validator. Its purpose is to
 * reject obviously malformed input at the domain boundary, not to replace
 * a dedicated validation library at the API boundary (see NFR-021).
 */
function isValidEmailFormat(email: string): boolean {
  const atIndex = email.indexOf("@");
  const dotIndex = email.lastIndexOf(".");

  return (
    atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < email.length - 1 && !email.includes(" ")
  );
}

export class InvalidUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUserError";
  }
}

/**
 * Domain invariants for User creation.
 *
 * Note: this does not assign an id or timestamps. Identifier and timestamp
 * generation belong to the infrastructure layer (repository), per
 * §41 ("Identifiers") and §40 ("Timestamps") of 05-data-model.md.
 */
export function validateNewUser(input: CreateUserInput): void {
  if (!input.email || !isValidEmailFormat(input.email)) {
    throw new InvalidUserError("A valid email is required.");
  }

  if (!input.displayName || input.displayName.trim().length === 0) {
    throw new InvalidUserError("Display name is required.");
  }
}
