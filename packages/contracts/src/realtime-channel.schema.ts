import { z } from "zod";
import { resourceIdSchema } from "./params.schema.js";

/**
 * Realtime channels (ADR-007 point 3, 08-realtime-spec.md §10).
 *
 * A channel is a name on the wire and a typed value in the code. `notifications`
 * carries no id: it is scoped to the authenticated user. `user:{userId}` and
 * `notifications:{userId}` do not exist.
 */
export type RealtimeChannel =
  | { readonly kind: "market"; readonly assetId: string }
  | { readonly kind: "portfolio"; readonly portfolioId: string }
  | { readonly kind: "jobs"; readonly jobId: string }
  | { readonly kind: "notifications" };

export const NOTIFICATIONS_CHANNEL = "notifications";

export function marketChannelName(assetId: string): string {
  return `market:${assetId}`;
}

export function portfolioChannelName(portfolioId: string): string {
  return `portfolio:${portfolioId}`;
}

export function jobsChannelName(jobId: string): string {
  return `jobs:${jobId}`;
}

/** The wire name of a typed channel. */
export function channelName(channel: RealtimeChannel): string {
  switch (channel.kind) {
    case "market":
      return marketChannelName(channel.assetId);
    case "portfolio":
      return portfolioChannelName(channel.portfolioId);
    case "jobs":
      return jobsChannelName(channel.jobId);
    case "notifications":
      return NOTIFICATIONS_CHANNEL;
  }
}

/**
 * Parses a wire name into a typed channel, or `null` for anything that is not
 * exactly one of the four shapes. The id follows the route-parameter rule
 * (`resourceIdSchema`), so a name cannot carry separators or whitespace.
 */
export function parseChannel(name: string): RealtimeChannel | null {
  if (name === NOTIFICATIONS_CHANNEL) {
    return { kind: "notifications" };
  }

  const separator = name.indexOf(":");

  if (separator < 1) {
    return null;
  }

  const prefix = name.slice(0, separator);
  const id = resourceIdSchema.safeParse(name.slice(separator + 1));

  if (!id.success) {
    return null;
  }

  switch (prefix) {
    case "market":
      return { kind: "market", assetId: id.data };
    case "portfolio":
      return { kind: "portfolio", portfolioId: id.data };
    case "jobs":
      return { kind: "jobs", jobId: id.data };
    default:
      return null;
  }
}

/** A channel name that parses; an unknown or malformed one is refused. */
export const channelNameSchema = z
  .string()
  .refine((name) => parseChannel(name) !== null, "Must be a known channel name.");
