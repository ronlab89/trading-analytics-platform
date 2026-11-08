/**
 * Credential entity.
 *
 * Intentionally separate from User (packages/domain/src/entities/user.ts).
 * See user-repository.ts's own documented boundary: "password/credential
 * handling is intentionally out of scope for [UserRepository] ... belongs
 * to a dedicated authentication capability." This entity is that
 * capability's domain model.
 *
 * This is a pure domain type. It never sees a raw plaintext password and
 * has no dependency on any specific hashing algorithm (bcrypt, argon2, or
 * otherwise) — hashing/comparison is an application-layer concern in the
 * consuming app (apps/api), keeping this entity deterministic and
 * infrastructure-free (NFR-042, NFR-043). It only ever stores and
 * transports an already-computed hash string.
 */
export interface Credential {
  readonly userId: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type CreateCredentialInput = Pick<Credential, "userId" | "passwordHash">;

export class InvalidCredentialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCredentialError";
  }
}

/**
 * Domain invariants for Credential creation.
 *
 * Deliberately does not validate raw password strength (minimum length,
 * character classes, etc.) — this entity never receives a raw password,
 * only a pre-computed hash. Raw-password policy validation belongs at
 * the API/application boundary, before hashing occurs (see
 * 09-security-spec.md §19-20, transport vs domain validation).
 */
export function validateNewCredential(input: CreateCredentialInput): void {
  if (!input.userId || input.userId.trim().length === 0) {
    throw new InvalidCredentialError("A userId is required.");
  }

  if (!input.passwordHash || input.passwordHash.trim().length === 0) {
    throw new InvalidCredentialError("A password hash is required.");
  }
}
