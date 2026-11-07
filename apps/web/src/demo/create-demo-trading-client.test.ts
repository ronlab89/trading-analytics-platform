import { API_OPERATIONS } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import { ApiError } from "@/api/trading-client";
import { createDemoComposition } from "./demo-composition";
import { createDemoTradingClient } from "./create-demo-trading-client";

const login = findOperation(API_OPERATIONS, "login");
const logout = findOperation(API_OPERATIONS, "logout");
const getCurrentUser = findOperation(API_OPERATIONS, "getCurrentUser");
const listPortfolios = findOperation(API_OPERATIONS, "listPortfolios");
const getLiveness = findOperation(API_OPERATIONS, "getLiveness");

async function setup() {
  const composition = await createDemoComposition();
  return createDemoTradingClient({ composition });
}

async function signedInClient() {
  const client = await setup();
  await client.call(login, { body: { email: "demo@example.com", password: "x" } });
  return client;
}

describe("createDemoTradingClient", () => {
  it("signs in with the shape of the API login response", async () => {
    const client = await setup();

    const answer = await client.call(login, { body: { email: "demo@example.com", password: "x" } });

    expect(answer).toMatchObject({
      data: {
        user: { id: "demo-user", role: "TRADER" },
        session: { accessToken: expect.any(String) as string },
      },
    });
  });

  it("lists the seeded portfolios of the signed-in user", async () => {
    const client = await signedInClient();

    const answer = await client.call(listPortfolios);

    expect(answer).toMatchObject({
      data: [
        { name: "Long-term growth", baseCurrency: "USD", status: "ACTIVE" },
        { name: "Dividend income", baseCurrency: "USD", status: "ACTIVE" },
        { name: "Crypto", baseCurrency: "USD", status: "ACTIVE" },
      ],
    });
  });

  it("refuses an authenticated operation without a session as 401", async () => {
    const client = await setup();

    await expect(client.call(listPortfolios)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    });
  });

  it("answers the current user while the session lasts and refuses it after logout", async () => {
    const client = await signedInClient();

    await expect(client.call(getCurrentUser)).resolves.toMatchObject({
      data: { user: { id: "demo-user" } },
    });

    await client.call(logout);

    await expect(client.call(getCurrentUser)).rejects.toMatchObject({ status: 401 });
  });

  it("answers an operation the demo never serves (a server health check) as 404 NOT_FOUND", async () => {
    const client = await signedInClient();

    const failure = await client.call(getLiveness).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});
