import type { Portfolio } from "@trading/domain";
import { composition } from "../composition.js";
import { transitionalActor } from "./transitional-actor.js";

/**
 * Transitional adapter for the services that have not moved to
 * `@trading/application` yet (alerts, analytics, decisions, overview,
 * positions, scenarios, transactions, user preferences). They still ask
 * "does this user own this portfolio" with a bare `userId`; the portfolio
 * use cases now take an `Actor`.
 *
 * `role` is a placeholder: B0.5 grants every permission to every role, so
 * the check cannot depend on it. Each service that moves receives the
 * portfolio service and the real actor instead, and this file is deleted
 * with the last of them (B0.5 T6).
 */
export function getPortfolioById(userId: string, portfolioId: string): Promise<Portfolio> {
  return composition.portfolioService.getPortfolioById(transitionalActor(userId), portfolioId);
}
