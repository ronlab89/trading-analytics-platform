import { describe, expect, it } from "vitest";
import { Money, TransactionStatus, TransactionType } from "@trading/domain";
import { InMemoryTransactionRepository } from "./in-memory-transaction-repository.js";

const now = new Date(Date.UTC(2026, 0, 30));

function input() {
  return {
    portfolioId: "p1",
    assetId: "a1",
    type: TransactionType.BUY,
    quantity: 5,
    price: Money.of("100", "USD"),
    executedAt: new Date(Date.UTC(2026, 0, 10)),
  };
}

function build() {
  return new InMemoryTransactionRepository({ now: () => now });
}

describe("InMemoryTransactionRepository snapshot and restore", () => {
  it("restore discards created transactions and status changes made after the snapshot", async () => {
    const repository = build();
    const kept = await repository.create(input());
    const snapshot = repository.snapshot();

    const extra = await repository.create(input());
    await repository.updateStatus(kept.id, TransactionStatus.COMPLETED);
    repository.restore(snapshot);

    expect(await repository.getById(kept.id)).toEqual(kept);
    expect(await repository.getById(extra.id)).toBeNull();
  });

  it("restore also rewinds the id sequence", async () => {
    const repository = build();
    const snapshot = repository.snapshot();
    const first = await repository.create(input());

    repository.restore(snapshot);
    const again = await repository.create(input());

    expect(again.id).toBe(first.id);
  });

  it("a snapshot is not changed by later writes and can be restored twice", async () => {
    const repository = build();
    const snapshot = repository.snapshot();

    const first = await repository.create(input());
    repository.restore(snapshot);
    await repository.create(input());
    repository.restore(snapshot);

    expect(await repository.getById(first.id)).toBeNull();
  });
});
