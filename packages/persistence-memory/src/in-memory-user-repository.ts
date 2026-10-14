import { UserRole } from "@trading/domain";
import type { CreateUserInput, User, UserRepository } from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/**
 * In-memory implementation of `UserRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: `role` defaults to USER, `email` is unique and
 * compared exactly (case-sensitive), `list` follows insertion order, and
 * `update` throws when the row does not exist. Only `displayName` and `role`
 * can change. Credentials live in their own repository and are never part of
 * a `User`.
 */
export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, User>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  list(): Promise<User[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  getById(id: string): Promise<User | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  getByEmail(email: string): Promise<User | null> {
    const found = [...this.rows.values()].find((user) => user.email === email);

    return Promise.resolve(found ?? null);
  }

  create(input: CreateUserInput): Promise<User> {
    if ([...this.rows.values()].some((user) => user.email === input.email)) {
      return Promise.reject(new Error(`A user with email ${input.email} already exists.`));
    }

    const timestamp = this.now();
    const user: User = {
      id: `user_${String(++this.sequence)}`,
      email: input.email,
      displayName: input.displayName,
      role: input.role ?? UserRole.USER,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.rows.set(user.id, user);

    return Promise.resolve(user);
  }

  update(id: string, input: Partial<Pick<User, "displayName" | "role">>): Promise<User> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`User ${id} does not exist.`));
    }

    const updated: User = {
      ...existing,
      displayName: input.displayName ?? existing.displayName,
      role: input.role ?? existing.role,
      updatedAt: this.now(),
    };
    this.rows.set(id, updated);

    return Promise.resolve(updated);
  }
}
