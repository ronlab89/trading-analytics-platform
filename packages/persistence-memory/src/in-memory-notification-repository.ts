import type {
  CreateNotificationInput,
  Notification,
  NotificationRepository,
} from "@trading/domain";
import type { InMemoryRepositoryOptions } from "./options.js";

export interface StoredNotification {
  readonly notification: Notification;
  /** Creation order, the tie-break between notifications that share a `createdAt`. */
  readonly sequence: number;
}

/** Opaque copy of the repository state, for `snapshot` and `restore`. */
export interface InMemoryNotificationSnapshot {
  readonly rows: ReadonlyMap<string, StoredNotification>;
  readonly sequence: number;
}

/**
 * In-memory implementation of `NotificationRepository`.
 * Source: docs/06-architecture.md §12-13, docs/12-demo-mode-spec.md §4.
 *
 * Mirrors the Prisma adapter: a new notification is unread with empty
 * metadata, the list is newest first and can be limited to unread ones,
 * `markAsRead` throws when the row does not exist, and `markAllAsRead` only
 * touches the user's unread notifications and never fails.
 */
export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly rows = new Map<string, StoredNotification>();
  private readonly now: () => Date;
  private sequence = 0;

  constructor(options: InMemoryRepositoryOptions = {}) {
    this.now = options.now ?? (() => new Date());
  }

  /** Captures the current state; used by the unit of work to roll back. */
  snapshot(): InMemoryNotificationSnapshot {
    return { rows: new Map(this.rows), sequence: this.sequence };
  }

  /** Replaces the current state with a snapshot; the snapshot stays reusable. */
  restore(snapshot: InMemoryNotificationSnapshot): void {
    this.rows.clear();
    for (const [id, row] of snapshot.rows) {
      this.rows.set(id, row);
    }
    this.sequence = snapshot.sequence;
  }

  listByUserId(userId: string, filter?: { unreadOnly?: boolean }): Promise<Notification[]> {
    const found = [...this.rows.values()]
      .filter(
        ({ notification: n }) => n.userId === userId && (!filter?.unreadOnly || n.readAt === null),
      )
      .sort(
        (a, b) =>
          b.notification.createdAt.getTime() - a.notification.createdAt.getTime() ||
          b.sequence - a.sequence,
      );

    return Promise.resolve(found.map((stored) => stored.notification));
  }

  getById(id: string): Promise<Notification | null> {
    return Promise.resolve(this.rows.get(id)?.notification ?? null);
  }

  create(input: CreateNotificationInput): Promise<Notification> {
    const sequence = ++this.sequence;

    const notification: Notification = {
      id: `notification_${String(sequence)}`,
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity,
      readAt: null,
      createdAt: this.now(),
      metadata: input.metadata ?? {},
    };
    this.rows.set(notification.id, { notification, sequence });

    return Promise.resolve(notification);
  }

  markAsRead(id: string, readAt: Date): Promise<Notification> {
    const existing = this.rows.get(id);

    if (!existing) {
      return Promise.reject(new Error(`Notification ${id} does not exist.`));
    }

    const notification: Notification = { ...existing.notification, readAt };
    this.rows.set(id, { notification, sequence: existing.sequence });

    return Promise.resolve(notification);
  }

  markAllAsRead(userId: string, readAt: Date): Promise<void> {
    for (const [id, stored] of this.rows) {
      if (stored.notification.userId === userId && stored.notification.readAt === null) {
        this.rows.set(id, {
          notification: { ...stored.notification, readAt },
          sequence: stored.sequence,
        });
      }
    }

    return Promise.resolve();
  }
}
