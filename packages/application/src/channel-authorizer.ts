import type { Job, JobRepository } from "@trading/domain";
import type { Actor } from "./actor.js";
import { NotFoundError } from "./errors.js";
import { ROLE_PERMISSIONS, hasPermission } from "./permissions.js";
import type { RolePermissions } from "./permissions.js";
import type { PortfolioService } from "./portfolio-service.js";

/**
 * A realtime channel as the application layer sees it. It has the same shape
 * as the contracts' `RealtimeChannel`, so the adapter passes a parsed channel
 * straight in without this package depending on the contracts.
 */
export type SubscriptionChannel =
  | { readonly kind: "market"; readonly assetId: string }
  | { readonly kind: "portfolio"; readonly portfolioId: string }
  | { readonly kind: "jobs"; readonly jobId: string }
  | { readonly kind: "notifications" };

export interface ChannelAuthorizerDependencies {
  portfolioService: Pick<PortfolioService, "getPortfolioById">;
  jobRepository: Pick<JobRepository, "getById">;
  /** Role matrix; defaults to the application matrix. Tests inject a restricted one. */
  permissions?: RolePermissions;
}

/**
 * Decides whether an actor may subscribe to a channel.
 * Source: ADR-007 point 3, 08-realtime-spec.md §10.
 *
 * `market:{assetId}` needs `market:read`, `notifications` needs
 * `notification:read` and is always the actor's own, `portfolio:{id}` needs
 * `portfolio:read` plus ownership, and `jobs:{id}` needs ownership of the job.
 *
 * The answer is a plain boolean: a channel that does not exist, one that
 * belongs to someone else and one the role may not read are all `false`, so the
 * refusal cannot confirm that another user's resource exists
 * (09-security-spec.md §14-15). Any failure other than "not found" is an
 * infrastructure error and propagates.
 */
export function createChannelAuthorizer(dependencies: ChannelAuthorizerDependencies) {
  const { portfolioService, jobRepository, permissions = ROLE_PERMISSIONS } = dependencies;

  async function ownsPortfolio(actor: Actor, portfolioId: string): Promise<boolean> {
    try {
      await portfolioService.getPortfolioById(actor, portfolioId);
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }

      throw error;
    }
  }

  async function ownsJob(actor: Actor, jobId: string): Promise<boolean> {
    const job: Job | null = await jobRepository.getById(jobId);

    return job?.userId === actor.userId;
  }

  async function canSubscribe(actor: Actor, channel: SubscriptionChannel): Promise<boolean> {
    switch (channel.kind) {
      case "market":
        return hasPermission(actor, "market:read", permissions);
      case "notifications":
        return hasPermission(actor, "notification:read", permissions);
      case "portfolio":
        return (
          hasPermission(actor, "portfolio:read", permissions) &&
          (await ownsPortfolio(actor, channel.portfolioId))
        );
      case "jobs":
        return ownsJob(actor, channel.jobId);
    }
  }

  return { canSubscribe };
}

export type ChannelAuthorizer = ReturnType<typeof createChannelAuthorizer>;
