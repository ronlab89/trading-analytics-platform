import { describe, expect, it } from "vitest";
import {
  channelName,
  channelNameSchema,
  jobsChannelName,
  marketChannelName,
  parseChannel,
  portfolioChannelName,
} from "./realtime-channel.schema.js";

describe("realtime channels", () => {
  it.each([
    ["market:asset_001", { kind: "market", assetId: "asset_001" }],
    ["portfolio:p-1", { kind: "portfolio", portfolioId: "p-1" }],
    ["jobs:cm1x", { kind: "jobs", jobId: "cm1x" }],
    ["notifications", { kind: "notifications" }],
  ] as const)("parses %s into a typed channel and back", (name, channel) => {
    expect(parseChannel(name)).toEqual(channel);
    expect(channelName(channel)).toBe(name);
    expect(channelNameSchema.safeParse(name).success).toBe(true);
  });

  it("builds the names of the id channels", () => {
    expect(marketChannelName("a1")).toBe("market:a1");
    expect(portfolioChannelName("p1")).toBe("portfolio:p1");
    expect(jobsChannelName("j1")).toBe("jobs:j1");
  });

  it.each([
    "",
    ":",
    "market",
    "market:",
    "market:has space",
    "market:a:b",
    "portfolio:" + "x".repeat(65),
    "user:u1",
    "notifications:u1",
    "notifications:",
    "Market:a1",
    "alerts",
  ])("refuses %j", (name) => {
    expect(parseChannel(name)).toBeNull();
    expect(channelNameSchema.safeParse(name).success).toBe(false);
  });
});
