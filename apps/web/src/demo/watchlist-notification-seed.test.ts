import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import type { DemoComposition } from "./demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Notification {
  type: string;
  title: string;
  severity: string;
  readAt: string | null;
}

let composition: DemoComposition | undefined;

afterEach(async () => {
  await composition?.jobRunner.stop();
});

async function openDemo(now: string) {
  composition = await createDemoComposition({ clock: fixedClock(new Date(now)) });
  const client = createDemoTradingClient({ composition });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  return client;
}

async function watchedSymbols(now = "2026-01-31T12:00:00Z") {
  const client = await openDemo(now);
  const watchlist = (await client.call(op("listWatchlist"))) as { data: { assetId: string }[] };
  const assets = (await client.call(op("listAssets"))) as {
    data: { id: string; symbol: string }[];
  };
  const symbolOf = new Map(assets.data.map((asset) => [asset.id, asset.symbol]));
  return watchlist.data.map((item) => symbolOf.get(item.assetId));
}

async function seededNotifications(now = "2026-01-31T12:00:00Z") {
  const client = await openDemo(now);
  const listed = (await client.call(op("listNotifications"))) as { data: Notification[] };
  return listed.data;
}

describe("demo watchlist seed", () => {
  it("opens with NVDA, SPY and ETH watched, and AAPL left out", async () => {
    const symbols = await watchedSymbols();

    expect([...symbols].sort()).toEqual(["ETH", "NVDA", "SPY"]);
  });

  it("gives the same watchlist for the same clock", async () => {
    expect(await watchedSymbols()).toEqual(await watchedSymbols());
  });
});

describe("demo notification seed", () => {
  it("opens with five notifications, two of them unread", async () => {
    const notifications = await seededNotifications();

    expect(notifications).toHaveLength(5);
    expect(notifications.filter((notification) => notification.readAt === null)).toHaveLength(2);
  });

  it("covers every severity and tells nothing about a fired alert", async () => {
    const notifications = await seededNotifications();

    expect(new Set(notifications.map((notification) => notification.severity))).toEqual(
      new Set(["INFO", "SUCCESS", "WARNING"]),
    );
    expect(notifications.map((notification) => notification.type)).not.toContain("ALERT_TRIGGERED");
  });

  it("gives the same notifications for the same clock", async () => {
    const strip = (notifications: Notification[]) =>
      notifications.map(({ type, title, severity, readAt }) => ({
        type,
        title,
        severity,
        read: readAt !== null,
      }));

    expect(strip(await seededNotifications())).toEqual(strip(await seededNotifications()));
  });
});
