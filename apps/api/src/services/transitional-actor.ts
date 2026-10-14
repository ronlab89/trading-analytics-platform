import { UserRole } from "@trading/domain";
import type { Actor } from "@trading/application";

/**
 * Actor for services that have not moved to `@trading/application` yet and
 * still call the moved use cases with a bare `userId` (or with nothing, for
 * global reference data such as assets).
 *
 * `role` is a placeholder: B0.5 grants every permission to every role, so
 * no check can depend on it. Each service that moves receives the real actor
 * from its controller instead; this file is deleted with the last of them
 * (B0.5 T6).
 */
export function transitionalActor(userId = "transitional"): Actor {
  return { userId, role: UserRole.USER };
}
