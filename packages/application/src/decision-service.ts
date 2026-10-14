import { projectDecisionReplay } from "@trading/domain";
import type {
  AssetRepository,
  Decision,
  DecisionDirection,
  DecisionEvent,
  DecisionEventRepository,
  DecisionReplayState,
  DecisionRepository,
} from "@trading/domain";
import type { Actor } from "./actor.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, assertPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

export interface DecisionServiceDependencies {
  decisionRepository: Pick<DecisionRepository, "listByPortfolioId" | "getById">;
  decisionEventRepository: Pick<DecisionEventRepository, "listByDecisionId">;
  assetRepository: Pick<AssetRepository, "getById">;
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

export interface ListDecisionsFilter {
  assetId?: string;
  direction?: DecisionDirection;
  dateFrom?: Date;
  dateTo?: Date;
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
 * Decision use cases (read-only).
 * Source: FR-032..FR-034, 07-api-spec.md §23-24.
 *
 * Ownership is enforced through the portfolio, so a decision of another
 * user's portfolio is indistinguishable from a missing one
 * (09-security-spec.md §15).
 */
export function createDecisionService(dependencies: DecisionServiceDependencies) {
  const {
    decisionRepository,
    decisionEventRepository,
    assetRepository,
    portfolioService,
    permissions = ROLE_PERMISSIONS,
  } = dependencies;

  /** Returns an owned portfolio's decisions, optionally filtered. */
  async function listDecisions(
    actor: Actor,
    portfolioId: string,
    filter: ListDecisionsFilter,
  ): Promise<Decision[]> {
    assertPermission(actor, "decision:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    return decisionRepository.listByPortfolioId(portfolioId, filter);
  }

  /** Returns one decision, scoped to its owning portfolio. */
  async function getDecisionById(
    actor: Actor,
    portfolioId: string,
    decisionId: string,
  ): Promise<Decision> {
    assertPermission(actor, "decision:read", permissions);
    await portfolioService.getPortfolioById(actor, portfolioId);

    const decision = await decisionRepository.getById(decisionId);

    if (decision?.portfolioId !== portfolioId) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    return decision;
  }

  /**
   * Returns everything a client needs to replay a decision (FR-034).
   *
   * The client controls playback (07-api-spec.md §24): it receives the
   * ordered events plus the currency and folds them itself with the same
   * pure `projectDecisionReplay` function from @trading/domain.
   * `initialState` is the projection before any event, so the first frame
   * renders without client work.
   *
   * The route is not nested under /portfolios/:portfolioId, so ownership
   * is resolved decision -> portfolio -> user.
   */
  async function getDecisionReplay(
    actor: Actor,
    decisionId: string,
  ): Promise<DecisionReplayResult> {
    assertPermission(actor, "decision:read", permissions);

    const decision = await decisionRepository.getById(decisionId);

    if (!decision) {
      throw new NotFoundError("The requested resource could not be found.");
    }

    // Throws the same NotFoundError when the portfolio belongs to another user.
    await portfolioService.getPortfolioById(actor, decision.portfolioId);

    const asset = await assetRepository.getById(decision.assetId);

    if (!asset) {
      // Decision.assetId is a Restrict foreign key, so this can only be a
      // data-integrity problem, not a client error. A plain Error is not
      // classified by the HTTP handler, so it surfaces as a generic 500.
      throw new Error(`Decision ${decisionId} references an asset that does not exist.`);
    }

    const events = await decisionEventRepository.listByDecisionId(decisionId);
    const initialState = projectDecisionReplay({ decision, events, currency: asset.currency }, -1);

    return { decision, events, currency: asset.currency, initialState };
  }

  return { listDecisions, getDecisionById, getDecisionReplay };
}

export type DecisionService = ReturnType<typeof createDecisionService>;
