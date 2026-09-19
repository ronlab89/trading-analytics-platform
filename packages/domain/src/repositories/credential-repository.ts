import type { CreateCredentialInput, Credential } from "../entities/credential";

/**
 * Credential repository contract.
 *
 * Deliberately separate from UserRepository (see credential.ts for the
 * full rationale). A login flow is expected to:
 *   1. UserRepository.getByEmail(email) -> User
 *   2. CredentialRepository.getByUserId(user.id) -> Credential
 *   3. Compare the supplied raw password against Credential.passwordHash
 *      using the application layer's hashing library (bcryptjs).
 *
 * This contract never accepts or returns a raw plaintext password.
 */
export interface CredentialRepository {
  /**
   * Returns the credential for a given user, or null if none exists
   * (e.g. a user created without ever setting a password).
   */
  getByUserId(userId: string): Promise<Credential | null>;

  /**
   * Creates a credential for a user that does not yet have one.
   * Callers are expected to have already hashed the password and to have
   * run `validateNewCredential` before calling this.
   */
  create(input: CreateCredentialInput): Promise<Credential>;

  /**
   * Replaces the password hash for an existing credential.
   * Used by future password-change/reset flows (09-security-spec.md §53).
   * Not consumed by the initial login-only implementation.
   */
  updatePasswordHash(userId: string, passwordHash: string): Promise<Credential>;
}
