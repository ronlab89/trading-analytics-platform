import { describe, expect, it } from "vitest";
import { connectionToStatus } from "./connection-status";

const at = (hours: number, minutes: number, seconds: number) =>
  new Date(2026, 10, 5, hours, minutes, seconds).getTime();
const CALCULATION = "14:32:07";

function statusOf(state: Parameters<typeof connectionToStatus>[0]["state"], lastDataAt?: number) {
  return connectionToStatus({
    state,
    lastDataAt,
    now: at(14, 32, 0),
    calculationTime: CALCULATION,
  });
}

describe("connectionToStatus", () => {
  it.each([
    ["connected", "live"],
    ["connecting", "connecting"],
    ["reconnecting", "reconnecting"],
    ["disconnected", "offline"],
    ["failed", "offline"],
  ] as const)("shows %s as %s", (state, connection) => {
    expect(statusOf(state).connection).toBe(connection);
  });

  it("counts the seconds since the last data while connected", () => {
    expect(statusOf("connected", at(14, 31, 57)).lastSync).toEqual({
      kind: "syncedAgo",
      seconds: 3,
    });
  });

  it("never counts a negative time when the clock is behind the data", () => {
    expect(statusOf("connected", at(14, 32, 2)).lastSync).toEqual({
      kind: "syncedAgo",
      seconds: 0,
    });
  });

  it.each(["connecting", "reconnecting", "disconnected", "failed"] as const)(
    "writes the time of the last data while %s",
    (state) => {
      expect(statusOf(state, at(14, 31, 5)).lastSync).toEqual({
        kind: "lastDataAt",
        time: "14:31:05",
      });
    },
  );

  it.each(["connected", "connecting", "reconnecting", "disconnected", "failed"] as const)(
    "says it is waiting when no data has arrived and the state is %s",
    (state) => {
      expect(statusOf(state).lastSync).toEqual({ kind: "waiting" });
    },
  );

  it.each(["connected", "connecting", "reconnecting"] as const)(
    "keeps the calculation up to date while %s",
    (state) => {
      expect(statusOf(state).calculation).toEqual({ kind: "upToDate", time: CALCULATION });
    },
  );

  it.each(["disconnected", "failed"] as const)("says the calculation stopped while %s", (state) => {
    expect(statusOf(state).calculation).toEqual({ kind: "stopped" });
  });
});
