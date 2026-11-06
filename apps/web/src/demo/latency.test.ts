import { API_OPERATIONS } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { createDemoTradingClient } from "./create-demo-trading-client";
import { createDemoComposition } from "./demo-composition";
import { createLatency, latencyFor } from "./latency";

const login = findOperation(API_OPERATIONS, "login");
const listPortfolios = findOperation(API_OPERATIONS, "listPortfolios");

describe("latency", () => {
  it("draws reads from 150 to 400 ms and writes from 400 to 900 ms", () => {
    expect(latencyFor("get", () => 0)).toBe(150);
    expect(latencyFor("get", () => 0.999999)).toBe(400);
    expect(latencyFor("post", () => 0)).toBe(400);
    expect(latencyFor("patch", () => 0.999999)).toBe(900);
    expect(latencyFor("delete", () => 0.5)).toBe(650);
  });

  it("waits before every call of the client, by the kind of the operation", async () => {
    const waits: number[] = [];
    const latency = createLatency({
      random: () => 0,
      sleep: (milliseconds) => {
        waits.push(milliseconds);
        return Promise.resolve();
      },
    });
    const client = createDemoTradingClient({ composition: await createDemoComposition(), latency });

    await client.call(login, { body: { email: "demo@example.com", password: "x" } });
    await client.call(listPortfolios);

    expect(waits).toEqual([400, 150]);
  });
});
