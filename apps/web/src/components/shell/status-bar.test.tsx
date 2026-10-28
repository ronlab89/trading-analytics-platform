import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import "@/i18n";
import { StatusBar } from "./status-bar";

const live = {
  connection: "live",
  lastSync: { kind: "syncedAgo", seconds: 3 },
  calculation: { kind: "upToDate", time: "14:32:07" },
  alertCount: 1,
} as const;

describe("StatusBar", () => {
  it.each([
    [
      "live",
      { ...live },
      ["Live", "Synced 3 s ago", "Calculation up to date · 14:32:07", "1 alert"],
    ],
    [
      "connecting",
      {
        ...live,
        connection: "connecting",
        lastSync: { kind: "waiting" },
      },
      ["Connecting…", "Waiting for the first data", "Calculation up to date · 14:32:07", "1 alert"],
    ],
    [
      "reconnecting",
      {
        ...live,
        connection: "reconnecting",
        lastSync: { kind: "lastDataAgo", seconds: 12 },
      },
      ["Reconnecting…", "Last data 12 s ago", "Calculation up to date · 14:32:07", "1 alert"],
    ],
    [
      "offline",
      {
        connection: "offline",
        lastSync: { kind: "lastDataAt", time: "14:31:55" },
        calculation: { kind: "stopped" },
        alertCount: 2,
      },
      ["Offline", "Last data 14:31:55", "Calculation stopped", "2 alerts"],
    ],
  ] as const)("shows the %s state as text", (_state, props, texts) => {
    render(<StatusBar {...props} />);

    for (const text of texts) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("announces the connection through a status region", () => {
    render(<StatusBar {...live} />);

    expect(screen.getByRole("status")).toHaveTextContent("Live");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<StatusBar {...live} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
