import type { UserRole } from "@trading/domain";

/**
 * Who is performing a use case.
 * Source: ADR-001 point 2, ADR-005 point 3.
 *
 * Built once per request by the authentication middleware and passed to
 * every use case instead of a bare `userId`. `role` is the current domain
 * `UserRole` for now; B2 migrates it (ADR-005 point 1).
 */
export interface Actor {
  readonly userId: string;
  readonly role: UserRole;
}
