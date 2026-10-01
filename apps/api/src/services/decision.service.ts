import {
  PrismaAssetRepository,
  PrismaDecisionEventRepository,
  PrismaDecisionRepository,
} from "@trading/database";
import {
  projectDecisionReplay,
  type Decision,
  type DecisionDirection,
  type DecisionEvent,
  type DecisionReplayState,
} from "@trading/domain";
import { AppError } from "../errors/app-error.js";
import { getPortfolioById } from "./portfolio.service.js";

const decisionRepository = new PrismaDecisionRepository();
const decisionEventRepository = new PrismaDecisionEventRepository();
const assetRepository = new PrismaAssetRepository();

export interface ListDecisionsFilter {
  assetId?: string;
  direction?: DecisionDirection;
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Returns a portfolio's decisions, optionally filtered.
 * Source: FR-032 (List Decisions), 07-api-spec.md §23.
 *
 * Ownership is enforced by requiring the portfolio to belong to the
 * caller first, same pattern as listTransactions.
 */
export async function listDecisions(
  userId: string,
  portfolioId: string,
  filter: ListDecisionsFilter,
): Promise<Decision[]> {
  await getPortfolioById(userId, portfolioId);

  return decisionRepository.listByPortfolioId(portfolioId, filter);
}

/**
 * Returns a single decision, scoped to its owning portfolio.
 * Source: FR-033 (Decision Detail), 07-api-spec.md §23.
 *
 * Same 404-on-mismatch pattern as getTransactionById: a decision
 * belonging to another portfolio (and therefore possibly another user)
 * is indistinguishable from a non-existent one.
 */
export async function getDecisionById(
  userId: string,
  portfolioId: string,
  decisionId: string,
): Promise<Decision> {
  await getPortfolioById(userId, portfolioId);

  const decision = await decisionRepository.getById(decisionId);

  if (decision?.portfolioId !== portfolioId) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  return decision;
}

export interface DecisionReplayResult {
  decision: Decision;
  /** Chronological order, as returned by the repository. */
  events: DecisionEvent[];
  /** The asset's currency: needed to interpret event payload prices. */
  currency: string;
  /** Projection at index -1 ("before the first event"). */
  initialState: DecisionReplayState;
}

/**
 * Returns everything a client needs to replay a decision.
 * Source: FR-034 (Replay Decision), 07-api-spec.md §24,
 * 06-architecture.md §53.
 *
 * The client controls playback (07-api-spec.md §24): it receives the
 * ordered events plus the currency and folds them itself with the same
 * pure `projectDecisionReplay` function from @trading/domain, so the
 * public demo behaves identically. `initialState` is the projection
 * before any event, so the first frame renders without client work.
 *
 * The route is not nested under /portfolios/:portfolioId (per the
 * spec), so ownership is resolved decision -> portfolio -> user. Both
 * a missing decision and one owned by someone else produce the same
 * 404 (anti-enumeration, 09-security-spec.md §15).
 */
export async function getDecisionReplay(
  userId: string,
  decisionId: string,
): Promise<DecisionReplayResult> {
  const decision = await decisionRepository.getById(decisionId);

  if (!decision) {
    throw new AppError("NOT_FOUND", "The requested resource could not be found.", 404);
  }

  // Throws the same 404 when the portfolio belongs to another user.
  await getPortfolioById(userId, decision.portfolioId);

  const asset = await assetRepository.getById(decision.assetId);

  if (!asset) {
    // Decision.assetId is a Restrict foreign key, so this can only be
    // a data-integrity problem, not a client error.
    throw new AppError("INTERNAL_ERROR", "An unexpected error occurred.", 500);
  }

  const events = await decisionEventRepository.listByDecisionId(decisionId);
  const initialState = projectDecisionReplay({ decision, events, currency: asset.currency }, -1);

  return { decision, events, currency: asset.currency, initialState };
}
