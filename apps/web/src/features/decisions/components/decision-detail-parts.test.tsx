import type { DecisionResponse } from "@trading/contracts";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import "@/i18n";
import type { TimelineItem } from "../lib/event-timeline";
import { DecisionDetailHeader } from "./decision-detail-header";
import { DecisionIndicators } from "./decision-indicators";
import { DecisionThesisPanel } from "./decision-thesis-panel";
import { DecisionTimelinePanel } from "./decision-timeline-panel";

const usd = (amount: string) => ({ amount, currency: "USD" });

const decision: DecisionResponse = {
  id: "d1",
  portfolioId: "p1",
  assetId: "a1",
  title: "Buy AAPL before earnings",
  thesis: "Services keep growing.",
  direction: "LONG",
  entryPrice: usd("162.40"),
  targetPrice: usd("190.00"),
  stopPrice: usd("158.00"),
  riskLevel: "MODERATE",
  createdAt: "2026-08-12T10:05:00.000Z",
  closedAt: null,
  outcome: null,
  notes: "Review the stop above $170.",
};

const item = (
  overrides: Partial<TimelineItem> & Pick<TimelineItem, "id" | "type">,
): TimelineItem => ({
  timestamp: "2026-08-14T15:40:00.000Z",
  quantity: null,
  price: null,
  riskLevel: null,
  text: null,
  ...overrides,
});

const created = item({ id: "e1", type: "DECISION_CREATED" });

const items = [
  created,
  item({
    id: "e2",
    type: "POSITION_OPENED",
    quantity: "236",
    price: usd("162.40"),
  }),
  item({ id: "e3", type: "RISK_CHANGED", riskLevel: "HIGH" }),
  item({ id: "e4", type: "NOTE_ADDED", text: "Take profits near the target." }),
];

describe("DecisionDetailHeader", () => {
  it("goes back to the list and says the direction and the status", () => {
    render(
      <MemoryRouter>
        <DecisionDetailHeader direction="LONG" status="OPEN" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: "Back to decisions" })).toHaveAttribute(
      "href",
      "/decisions",
    );
    expect(screen.getByText("Long")).toBeVisible();
    expect(screen.getByText("Open")).toBeVisible();
  });
});

describe("DecisionIndicators", () => {
  it("shows the entry, the target, the stop and the risk, with how far each is from the entry", () => {
    render(<DecisionIndicators decision={decision} items={items} />);

    const region = (name: string) => within(screen.getByRole("region", { name }));
    expect(region("Entry").getByText("$162.40")).toBeVisible();
    expect(region("Entry").getByText(/· 236 units$/)).toBeVisible();
    expect(region("Target").getByText("$190.00")).toBeVisible();
    expect(region("Target").getByText("+17.00% from the entry")).toBeVisible();
    expect(region("Stop").getByText("-2.71% from the entry")).toBeVisible();
    expect(region("Risk").getByText("Medium")).toBeVisible();
  });

  it("says no position was opened when the events do not open one", () => {
    render(<DecisionIndicators decision={decision} items={[created]} />);

    expect(screen.getByText("No position opened yet")).toBeVisible();
  });

  it("shows a dash and says it is not set for a price the decision does not set", () => {
    render(
      <DecisionIndicators
        decision={{ ...decision, stopPrice: null, riskLevel: null }}
        items={items}
      />,
    );

    expect(within(screen.getByRole("region", { name: "Stop" })).getByText("—")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Stop" })).getByText("Not set")).toBeVisible();
    expect(within(screen.getByRole("region", { name: "Risk" })).getByText("—")).toBeVisible();
  });
});

describe("DecisionTimelinePanel", () => {
  it("lists the events in order, each with what it did", () => {
    render(<DecisionTimelinePanel items={items} />);

    const events = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(events).toHaveLength(4);
    ["Decision recorded", "Position opened", "Risk changed", "Note added"].forEach(
      (name, index) => {
        expect(events[index]).toHaveTextContent(name);
      },
    );
    expect(screen.getByText("236 units at $162.40")).toBeVisible();
    expect(screen.getByText("Risk is now high")).toBeVisible();
    expect(screen.getByText("Take profits near the target.")).toBeVisible();
    expect(screen.getByText("4 events · the latest is highlighted")).toBeVisible();
  });

  it("says only what happened when an event has no figures", () => {
    render(<DecisionTimelinePanel items={[item({ id: "e1", type: "POSITION_OPENED" })]} />);

    expect(screen.getByText("Position opened")).toBeVisible();
    expect(screen.queryByText(/units at/)).not.toBeInTheDocument();
  });

  it("says there are no events yet", () => {
    render(<DecisionTimelinePanel items={[]} />);

    expect(screen.getByText("No events recorded yet.")).toBeVisible();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});

describe("DecisionThesisPanel", () => {
  it("writes the thesis and the notes of the decision", () => {
    render(<DecisionThesisPanel decision={decision} />);

    expect(screen.getByRole("heading", { name: "Thesis and context" })).toBeVisible();
    expect(screen.getByText("Services keep growing.")).toBeVisible();
    expect(screen.getByText("Review the stop above $170.")).toBeVisible();
  });

  it("says there are no notes when the decision has none", () => {
    render(<DecisionThesisPanel decision={{ ...decision, notes: null }} />);

    expect(screen.getByText("No notes.")).toBeVisible();
  });
});
