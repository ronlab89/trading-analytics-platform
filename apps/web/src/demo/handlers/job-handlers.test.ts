import { fixedClock } from "@trading/application";
import { API_OPERATIONS } from "@trading/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findOperation } from "@/api/find-operation";
import type { TradingClient } from "@/api/trading-client";
import { createDemoTradingClient } from "../create-demo-trading-client";
import { createDemoComposition } from "../demo-composition";
import type { DemoComposition } from "../demo-composition";

const op = (id: string) => findOperation(API_OPERATIONS, id);

interface JobData {
  id: string;
  status: string;
  failureReason: string | null;
  report: { row: number; message: string }[] | null;
}

const HEADER = "symbol,type,quantity,price,fees,executedAt";

let composition: DemoComposition;
let client: TradingClient;
let portfolioId: string;

beforeEach(async () => {
  composition = await createDemoComposition({
    clock: fixedClock(new Date("2026-01-31T12:00:00Z")),
  });
  client = createDemoTradingClient({ composition });
  composition.jobRunner.start();
  await client.call(op("login"), { body: { email: "demo@example.com", password: "x" } });
  const portfolios = (await client.call(op("listPortfolios"))) as { data: { id: string }[] };
  portfolioId = portfolios.data[0]?.id ?? "";
});

afterEach(async () => {
  await composition.jobRunner.stop();
});

async function startImport(csv: string, idempotencyKey?: string) {
  const answer = (await client.call(op("importTransactions"), {
    params: { portfolioId },
    body: csv,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  })) as { data: JobData };
  return answer.data;
}

async function settled(jobId: string): Promise<JobData> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const { data } = (await client.call(op("getJob"), { params: { jobId } })) as { data: JobData };
    if (data.status === "COMPLETED" || data.status === "FAILED" || data.status === "CANCELLED") {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The job did not settle");
}

async function transactionTotal() {
  const listed = (await client.call(op("listTransactions"), { params: { portfolioId } })) as {
    meta: { total: number };
  };
  return listed.meta.total;
}

describe("job handlers", () => {
  it("queues an import as a job and the runner applies a valid file", async () => {
    const job = await startImport(
      `${HEADER}\nAAPL,BUY,2,190,,2026-01-20\nMSFT,BUY,1,410,,2026-01-21`,
    );

    expect(job.status).toBe("QUEUED");
    expect((await settled(job.id)).status).toBe("COMPLETED");
    expect(await transactionTotal()).toBe(5);
  });

  it("fails a file with a bad row, reports the row and applies nothing", async () => {
    const job = await startImport(
      `${HEADER}\nAAPL,BUY,2,190,,2026-01-20\nAAPL,BUY,abc,190,,2026-01-21`,
    );

    const done = await settled(job.id);

    expect(done.status).toBe("FAILED");
    expect(done.report).toEqual([expect.objectContaining({ row: 3 })]);
    expect(await transactionTotal()).toBe(3);
  });

  it("refuses an empty body as 400 and an unknown portfolio as 404", async () => {
    await expect(
      client.call(op("importTransactions"), { params: { portfolioId }, body: "  " }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    await expect(
      client.call(op("importTransactions"), { params: { portfolioId: "missing" }, body: HEADER }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("does not import twice when the same key is sent again", async () => {
    const csv = `${HEADER}\nAAPL,BUY,2,190,,2026-01-20`;

    const first = await startImport(csv, "import-1");
    const second = await startImport(csv, "import-1");
    await settled(first.id);

    expect(second.id).toBe(first.id);
    expect(await transactionTotal()).toBe(4);
  });

  it("refuses to retry a validation failure with 409, as the API does", async () => {
    const job = await startImport(`${HEADER}
AAPL,BUY,abc,190,,2026-01-21`);
    await settled(job.id);

    await expect(client.call(op("retryJob"), { params: { jobId: job.id } })).rejects.toMatchObject({
      code: "CONFLICT",
      status: 409,
    });
  });

  it("answers 404 for an unknown job", async () => {
    await expect(client.call(op("getJob"), { params: { jobId: "missing" } })).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
        status: 404,
      },
    );
  });

  it("cancels a job that has not finished and lets it be retried", async () => {
    await composition.jobRunner.stop();
    const job = await startImport(`${HEADER}\nAAPL,BUY,2,190,,2026-01-20`);

    const cancelled = (await client.call(op("cancelJob"), { params: { jobId: job.id } })) as {
      data: JobData;
    };

    expect(cancelled.data.status).toBe("CANCELLED");

    composition.jobRunner.start();
    const retried = (await client.call(op("retryJob"), { params: { jobId: job.id } })) as {
      data: JobData;
    };
    expect(retried.data.status).toBe("QUEUED");
    expect((await settled(job.id)).status).toBe("COMPLETED");
  });
});
