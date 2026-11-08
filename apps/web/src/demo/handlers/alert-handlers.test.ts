import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";
import type { DemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface Alert {
  id: string;
  assetId: string;
  threshold: number;
  enabled: boolean;
}

let composition: DemoComposition;
let client: TradingClient;
let aaplId: string;
let portfolioId: string;

beforeEach(async () => {
  composition = await createDemoComposition({
    clock: fixedClock(new Date("2026-01-31T12:00:00Z")),
  });
  client = createDemoTradingClient({ composition });
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const assets = (await client.call(op("listAssets"), { query: { search: "AAPL" } })) as {
    data: { id: string }[];
  };
  aaplId = assets.data[0]?.id ?? "";
  const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
  portfolioId = portfolios.data[0]?.id ?? "";
});

afterEach(async () => {
  await composition.jobRunner.stop();
});

const priceAlert = { assetId: "", type: "PRICE", condition: "ABOVE", threshold: 200 };

async function createAlert() {
  const created = (await client.call(op("createAlert"), {
    body: { ...priceAlert, assetId: aaplId },
  })) as { data: Alert };
  return created.data;
}

describe("alert handlers", () => {
  it("creates, lists, gets, updates and deletes a price alert", async () => {
    const alert = await createAlert();
    const params = { alertId: alert.id };

    const listed = (await client.call(op("listAlerts"))) as { data: Alert[] };
    expect(listed.data).toContainEqual(
      expect.objectContaining({ id: alert.id, assetId: aaplId, threshold: 200 }),
    );
    await expect(client.call(op("getAlert"), { params })).resolves.toMatchObject({
      data: { id: alert.id },
    });
    await expect(
      client.call(op("updateAlert"), { params, body: { threshold: 250, enabled: false } }),
    ).resolves.toMatchObject({ data: { threshold: 250, enabled: false } });
    await expect(client.call(op("deleteAlert"), { params })).resolves.toBeUndefined();
    const remaining = (await client.call(op("listAlerts"))) as { data: Alert[] };
    expect(remaining.data.map((listedAlert) => listedAlert.id)).not.toContain(alert.id);
  });

  it("refuses an alert with no asset or portfolio, and an empty update", async () => {
    await expect(
      client.call(op("createAlert"), { body: { type: "PRICE", condition: "ABOVE", threshold: 1 } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    const alert = await createAlert();
    await expect(
      client.call(op("updateAlert"), { params: { alertId: alert.id }, body: {} }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("answers 404 for an alert that does not exist", async () => {
    await expect(
      client.call(op("getAlert"), { params: { alertId: "missing" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("notification handlers", () => {
  async function importCompleted() {
    composition.jobRunner.start();
    const job = (await client.call(op("importTransactions"), {
      params: { portfolioId },
      body: "symbol,type,quantity,price,fees,executedAt\nAAPL,BUY,1,190,,2026-01-20",
    })) as { data: { id: string } };
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const { data } = (await client.call(op("getJob"), { params: { jobId: job.data.id } })) as {
        data: { status: string };
      };
      if (data.status === "COMPLETED") return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("The import did not complete");
  }

  it("opens with the seeded notifications and receives one more when an import completes", async () => {
    interface Listed {
      data: { readAt: string | null }[];
    }
    const before = (await client.call(op("listNotifications"))) as Listed;
    expect(before.data).toHaveLength(5);
    expect(before.data.filter((notification) => notification.readAt === null)).toHaveLength(2);

    await importCompleted();

    const after = (await client.call(op("listNotifications"))) as Listed;
    expect(after.data).toHaveLength(6);
    expect(after.data.filter((notification) => notification.readAt === null)).toHaveLength(3);
  });

  it("marks one notification and then all as read, and filters the unread", async () => {
    await importCompleted();
    const listed = (await client.call(op("listNotifications"))) as { data: { id: string }[] };
    const id = listed.data[0]?.id ?? "";

    await expect(
      client.call(op("markNotificationRead"), { params: { notificationId: id } }),
    ).resolves.toMatchObject({ data: { id, readAt: expect.any(String) as unknown } });
    await expect(client.call(op("markAllNotificationsRead"))).resolves.toBeUndefined();
    await expect(
      client.call(op("listNotifications"), { query: { unreadOnly: true } }),
    ).resolves.toMatchObject({ data: [] });
  });
});

describe("simulation handlers", () => {
  it("leaves the control to an administrator: the demo trader gets 403", async () => {
    for (const [operationId, body] of [
      ["startSimulation", undefined],
      ["pauseSimulation", undefined],
      ["setSimulationMode", { mode: "VOLATILE" }],
    ] as const) {
      await expect(client.call(op(operationId), { body })).rejects.toMatchObject({
        code: "FORBIDDEN",
        status: 403,
      });
    }
  });

  it("starts running in the normal mode and follows the control of an administrator", () => {
    const admin = { userId: composition.actor.userId, role: "ADMIN" } as const;

    expect(composition.simulationControl.status()).toEqual({ state: "RUNNING", mode: "NORMAL" });
    expect(composition.simulationService.pauseSimulation(admin)).toEqual({
      state: "HALTED",
      mode: "NORMAL",
    });
    expect(composition.simulationService.changeSimulationMode(admin, "BULLISH")).toEqual({
      state: "HALTED",
      mode: "BULLISH",
    });
  });

  it("refuses an unknown mode as 400 before checking the role", async () => {
    await expect(
      client.call(op("setSimulationMode"), { body: { mode: "SIDEWAYS" } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });
});
