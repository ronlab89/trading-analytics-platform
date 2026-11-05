import type { NotificationResponse } from "@trading/contracts";
import { describe, expect, it } from "vitest";
import { PANEL_ROWS, toPanelRows } from "./panel-rows";

function notification(id: string, createdAt: string, readAt: string | null = null) {
  return {
    id,
    userId: "u1",
    type: "TEST",
    title: id,
    message: "Message",
    severity: "INFO",
    readAt,
    createdAt,
    metadata: {},
  } satisfies NotificationResponse;
}

describe("toPanelRows", () => {
  it("lists the newest first, whatever order the API gave", () => {
    const rows = toPanelRows([
      notification("old", "2026-11-05T10:00:00.000Z"),
      notification("new", "2026-11-05T14:00:00.000Z"),
      notification("mid", "2026-11-05T12:00:00.000Z"),
    ]);

    expect(rows.map(({ id }) => id)).toEqual(["new", "mid", "old"]);
  });

  it("keeps the notifications already read", () => {
    const rows = toPanelRows([
      notification("read", "2026-11-05T14:00:00.000Z", "2026-11-05T15:00:00.000Z"),
      notification("unread", "2026-11-05T13:00:00.000Z"),
    ]);

    expect(rows.map(({ id }) => id)).toEqual(["read", "unread"]);
  });

  it("lists at most eight by default, the newest ones", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      notification(`n${String(i)}`, `2026-11-05T${String(10 + i).padStart(2, "0")}:00:00.000Z`),
    );

    const rows = toPanelRows(many);

    expect(PANEL_ROWS).toBe(8);
    expect(rows).toHaveLength(8);
    expect(rows[0]?.id).toBe("n11");
    expect(rows[7]?.id).toBe("n4");
  });

  it("does not reorder the list it was given", () => {
    const list = [
      notification("old", "2026-11-05T10:00:00.000Z"),
      notification("new", "2026-11-05T14:00:00.000Z"),
    ];

    toPanelRows(list);

    expect(list.map(({ id }) => id)).toEqual(["old", "new"]);
  });

  it("is empty for no notifications", () => {
    expect(toPanelRows([])).toEqual([]);
  });
});
