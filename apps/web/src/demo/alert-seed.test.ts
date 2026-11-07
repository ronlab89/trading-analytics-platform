import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import type { DemoComposition } from "./demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Alert {
  type: string;
  condition: string;
  threshold: number;
  enabled: boolean;
  assetId: string | null;
  portfolioId: string | null;
}

let composition: DemoComposition | undefined;

afterEach(async () => {
  await composition?.jobRunner.stop();
});

async function openDemo(now = "2026-01-31T12:00:00Z") {
  composition = await createDemoComposition({ clock: fixedClock(new Date(now)) });
  const client = createDemoTradingClient({ composition });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  return client;
}

async function seededAlerts() {
  const client = await openDemo();
  const listed = (await client.call(op("listAlerts"))) as { data: Alert[] };
  return listed.data;
}

describe("demo alert seed", () => {
  it("opens with four alerts, three of them enabled and none already fired", async () => {
    const client = await openDemo();

    const listed = (await client.call(op("listAlerts"))) as { data: Alert[] };
    const notifications = (await client.call(op("listNotifications"))) as {
      data: { type: string }[];
    };

    expect(listed.data).toHaveLength(4);
    expect(listed.data.filter((alert) => alert.enabled)).toHaveLength(3);
    expect(notifications.data.map((notification) => notification.type)).not.toContain(
      "ALERT_TRIGGERED",
    );
  });

  it("covers price alerts on assets and one change alert on the first portfolio", async () => {
    const alerts = await seededAlerts();

    expect(alerts.filter((alert) => alert.type === "PRICE")).toHaveLength(3);
    expect(alerts.filter((alert) => alert.type === "PRICE").every((a) => a.assetId !== null)).toBe(
      true,
    );
    const change = alerts.filter((alert) => alert.type === "PORTFOLIO_CHANGE");
    expect(change).toHaveLength(1);
    expect(change[0]).toMatchObject({ condition: "BELOW", threshold: -5 });
    expect(change[0]?.portfolioId).not.toBeNull();
  });

  it("gives the same alerts for the same clock", async () => {
    const strip = (alerts: Alert[]) =>
      alerts.map(({ type, condition, threshold, enabled }) => ({
        type,
        condition,
        threshold,
        enabled,
      }));

    const first = strip(await seededAlerts());
    const second = strip(await seededAlerts());

    expect(second).toEqual(first);
  });
});
