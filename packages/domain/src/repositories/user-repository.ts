import type { CreateUserInput, User } from "../entities/user";

/**
 * User repository contract.
 * Source: docs/06-architecture.md §12 (Repository Pattern)
 *
 * See portfolio-repository.ts for the full rationale on why this
 * contract lives in packages/domain with zero infrastructure
 * dependencies.
 */
export interface UserRepository {
  /**
   * Returns all users.
   * Administrative operation — authorization (e.g. requiring ADMIN role)
   * is an application-layer concern, not this repository's.
   */
  list(): Promise<User[]>;

  /**
   * Returns a single user by id, or null if it does not exist.
   */
  getById(id: string): Promise<User | null>;

  /**
   * Returns a single user by email, or null if it does not exist.
   * Source: FR-001 (User Login) — authentication looks up users by email.
   */
  getByEmail(email: string): Promise<User | null>;

  /**
   * Creates a new user.
   *
   * Callers are expected to have already run `validateNewUser` (see
   * entities/user.ts) before calling this. Callers are also expected to
   * have already enforced email uniqueness at the application layer if
   * a duplicate-email check with a specific user-facing error is needed;
   * the underlying table also enforces this via a unique constraint as a
   * defense-in-depth measure (see packages/database schema.prisma).
   */
  create(input: CreateUserInput): Promise<User>;

  /**
   * Updates supported, mutable fields of an existing user.
   * Password/credential handling is intentionally out of scope for this
   * contract — see docs/09-security-spec.md §52 (Password Policy), which
   * belongs to a dedicated authentication capability, not this repository.
   */
  update(id: string, input: Partial<Pick<User, "displayName" | "role">>): Promise<User>;
}
