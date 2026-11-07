import { API_OPERATIONS } from "@trading/contracts";
import { beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);
const login = op("login");
const listPortfolios = op("listPortfolios");
const createPortfolio = op("createPortfolio");
const getPortfolio = op("getPortfolio");
const updatePortfolio = op("updatePortfolio");
const archivePortfolio = op("archivePortfolio");

interface Listed {
  data: { id: string; name: string; status: string }[];
}

let client: TradingClient;

beforeEach(async () => {
  client = createDemoTradingClient({ composition: await createDemoComposition() });
  await client.call(login, { body: { email: "demo@example.com", password: "x" } });
});

async function createdId(name = "Income") {
  const created = (await client.call(createPortfolio, {
    body: { name, baseCurrency: "EUR" },
  })) as { data: { id: string } };
  return created.data.id;
}

describe("portfolio handlers", () => {
  it("creates a portfolio and lists it after the seeded ones", async () => {
    await createdId("Income");

    const listed = (await client.call(listPortfolios)) as Listed;

    expect(listed.data.map((portfolio) => portfolio.name)).toEqual([
      "Long-term growth",
      "Dividend income",
      "Crypto",
      "Income",
    ]);
  });

  it("refuses a creation with a missing name as 400 with one detail for the field", async () => {
    await expect(
      client.call(createPortfolio, { body: { baseCurrency: "USD" } }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
      details: [expect.objectContaining({ field: "name" }) as unknown],
    });
  });

  it("gets a portfolio by id and answers 404 for an unknown one", async () => {
    const id = await createdId();

    await expect(client.call(getPortfolio, { params: { portfolioId: id } })).resolves.toMatchObject(
      { data: { id, name: "Income", baseCurrency: "EUR" } },
    );
    await expect(
      client.call(getPortfolio, { params: { portfolioId: "missing" } }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("updates the name and description but refuses a change of the currency", async () => {
    const id = await createdId();

    await expect(
      client.call(updatePortfolio, {
        params: { portfolioId: id },
        body: { name: "Dividends", description: "Yield" },
      }),
    ).resolves.toMatchObject({ data: { name: "Dividends", description: "Yield" } });
    await expect(
      client.call(updatePortfolio, { params: { portfolioId: id }, body: { baseCurrency: "USD" } }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
  });

  it("archives once, reports a repeat in the meta and then refuses an update with 409", async () => {
    const id = await createdId();

    await expect(
      client.call(archivePortfolio, { params: { portfolioId: id } }),
    ).resolves.toMatchObject({ data: { status: "ARCHIVED" }, meta: { alreadyArchived: false } });
    await expect(
      client.call(archivePortfolio, { params: { portfolioId: id } }),
    ).resolves.toMatchObject({ meta: { alreadyArchived: true } });
    await expect(
      client.call(updatePortfolio, { params: { portfolioId: id }, body: { name: "Late" } }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });
});
