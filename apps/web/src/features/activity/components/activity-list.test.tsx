import { render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { describe, expect, it } from "vitest";
import "@/i18n";
import type { ActivityDay, ActivityEvent } from "../lib/activity-events";
import { ActivityList } from "./activity-list";

function event(id: string, overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id,
    source: "ALERT",
    severity: "WARNING",
    title: `Title ${id}`,
    message: `Message ${id}`,
    occurredAt: "2026-11-04T14:29:00.000Z",
    ...overrides,
  };
}

const days: ActivityDay[] = [
  {
    day: "2026-11-04",
    label: "today",
    events: [
      event("a", { severity: "ERROR" }),
      event("b", { source: "TRANSACTION", severity: "SUCCESS", transactionId: "t1" }),
    ],
  },
  { day: "2026-11-03", label: "yesterday", events: [event("c", { severity: "INFO" })] },
  { day: "2026-10-20", label: "date", events: [event("d")] },
];

describe("ActivityList", () => {
  it("draws a section per day, headed by today, yesterday and the date, with how many events it has", () => {
    render(<ActivityList days={days} />);

    const today = screen.getByRole("region", { name: /today/i });
    expect(within(today).getByRole("heading", { level: 2, name: "Today" })).toBeInTheDocument();
    expect(within(today).getByText("2 events")).toBeInTheDocument();
    const yesterday = screen.getByRole("region", { name: /yesterday/i });
    expect(within(yesterday).getByText("1 event")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Oct 20, 2026" })).toBeInTheDocument();
  });

  it("lists every event of a day as an item with its title, message, source and time", () => {
    render(<ActivityList days={days} />);

    const today = screen.getByRole("region", { name: /today/i });
    expect(within(today).getAllByRole("listitem")).toHaveLength(2);
    expect(within(today).getByText(/Title a/)).toBeInTheDocument();
    expect(within(today).getByText("Message a")).toBeInTheDocument();
    expect(within(today).getByText(/Alert · \d{2}:\d{2}/)).toBeInTheDocument();
    expect(within(today).getByText(/Transaction · \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("says the severity in words, so it is not only a colour or an icon", () => {
    render(<ActivityList days={days} />);

    const today = screen.getByRole("region", { name: /today/i });
    expect(within(today).getByText("Error:")).toBeInTheDocument();
    expect(within(today).getByText("Success:")).toBeInTheDocument();
  });

  it("puts the action the caller gives on the event it is for", () => {
    render(
      <ActivityList
        days={days}
        renderAction={(item) =>
          item.transactionId === undefined ? null : <a href="#t">View transaction</a>
        }
      />,
    );

    expect(screen.getAllByRole("link", { name: "View transaction" })).toHaveLength(1);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ActivityList days={days} />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
