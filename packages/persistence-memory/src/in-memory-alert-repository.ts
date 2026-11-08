import type { Alert, AlertRepository, AlertUpdate, CreateAlertInput } from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

/** Opaque copy of the repository state, for `snapshot` and `restore`. */
export interface InMemoryAlertSnapshot {
  readonly rows: ReadonlyMap<string, Alert>;
  readonly sequence: number;
}

/**
 * In-memory implementation of `AlertRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: a new alert is enabled and armed, never fired,
 * and has no asset or portfolio unless given, alerts are listed in insertion order, `update`
 * moves `updatedAt` and ignores undefined fields, and `update` and `delete`
 * throw when the row does not exist.
 */
export class InMemoryAlertRepository implements AlertRepository {
  private readonly rows = new Map<string, Alert>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  /** Captures the current state; used by the unit of work to roll back. */
  snapshot(): InMemoryAlertSnapshot {
    return { rows: new Map(this.rows), sequence: this.sequence };
  }

  /** Replaces the current state with a snapshot; the snapshot stays reusable. */
  restore(snapshot: InMemoryAlertSnapshot): void {
    this.rows.clear();
    for (const [id, row] of snapshot.rows) {
      this.rows.set(id, row);
    }
    this.sequence = snapshot.sequence;
  }

  listByUserId(userId: string): Promise<Alert[]> {
    return Promise.resolve([...this.rows.values()].filter((row) => row.userId === userId));
  }

  getById(id: string): Promise<Alert | null> {
    return Promise.resolve(this.rows.get(id) ?? null);
  }

  listEnabledByAssetIds(assetIds: readonly string[]): Promise<Alert[]> {
    return Promise.resolve(
      [...this.rows.values()].filter(
        (row) => row.enabled && row.assetId !== null && assetIds.includes(row.assetId),
      ),
    );
  }

  create(input: CreateAlertInput): Promise<Alert> {
    const timestamp = this.now();

    const alert: Alert = {
      id: `alert_${String(++this.sequence)}`,
      userId: input.userId,
      assetId: input.assetId ?? null,
      portfolioId: input.portfolioId ?? null,
      type: input.type,
      condition: input.condition,
      threshold: input.threshold,
      enabled: input.enabled ?? true,
      armed: input.armed ?? true,
      lastTriggeredAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.rows.set(alert.id, alert);

    return Promise.resolve(alert);
  }

  update(id: string, input: AlertUpdate): Promise<Alert> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Alert ${id} does not exist.`));
    }

    // Prisma ignores undefined fields; the type forbids them, but callers can still pass one.
    const changes = Object.fromEntries(
      Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined),
    ) as AlertUpdate;
    const alert: Alert = { ...existing, ...changes, updatedAt: this.now() };
    this.rows.set(id, alert);

    return Promise.resolve(alert);
  }

  delete(id: string): Promise<void> {
    if (!this.rows.delete(id)) {
      return Promise.reject(new Error(`Alert ${id} does not exist.`));
    }

    return Promise.resolve();
  }
}
