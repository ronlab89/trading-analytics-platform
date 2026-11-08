import type { DecisionReplayStateResponse, DecisionResponse } from "@trading/contracts";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
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
  const openState: DecisionReplayStateResponse = {
    currentIndex: 3,
    totalEvents: 4,
    currentEvent: null,
    phase: "OPEN",
    thesis: null,
    riskLevel: "MODERATE",
    notes: [],
    position: { quantity: "236", entryPrice: usd("162.40") },
    lastPrice: usd("180.70"),
    unrealizedPnL: usd("4318.80"),
    realizedPnL: null,
    issues: [],
  };
  const region = (name: string) => within(screen.getByRole("region", { name }));

  it("shows the entry, the target, the stop and the current return, with how far each is from the entry", () => {
    render(<DecisionIndicators decision={decision} items={items} state={openState} />);

    expect(region("Entry").getByText("$162.40")).toBeVisible();
    expect(region("Entry").getByText(/· 236 units$/)).toBeVisible();
    expect(region("Target").getByText("$190.00")).toBeVisible();
    expect(region("Target").getByText("+17.00% from the entry")).toBeVisible();
    expect(region("Stop").getByText("-2.71% from the entry")).toBeVisible();
    expect(region("Current return").getByText("+11.27%")).toBeVisible();
    expect(region("Current return").getByText("Price $180.70 · medium risk")).toBeVisible();
  });

  it("on a phone leaves the risk out of the note, as there is less room", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<DecisionIndicators decision={decision} items={items} state={openState} />);

    expect(region("Current return").getByText("Price $180.70")).toBeVisible();
    vi.unstubAllGlobals();
  });

  it("says a gain or a loss with an arrow too, not with the color alone", () => {
    const { container, rerender } = render(
      <DecisionIndicators decision={decision} items={items} state={openState} />,
    );
    expect(container.querySelector(".lucide-arrow-up")).toBeInTheDocument();

    rerender(
      <DecisionIndicators
        decision={decision}
        items={items}
        state={{ ...openState, lastPrice: usd("150.00") }}
      />,
    );
    expect(container.querySelector(".lucide-arrow-down")).toBeInTheDocument();
  });

  it("paints a loss as a loss", () => {
    render(
      <DecisionIndicators
        decision={decision}
        items={items}
        state={{ ...openState, lastPrice: usd("150.00") }}
      />,
    );

    expect(region("Current return").getByText("-7.64%")).toHaveClass("text-(--color-trading-loss)");
  });

  it("shows what a closed position made and where it closed", () => {
    render(
      <DecisionIndicators
        decision={decision}
        items={items}
        state={{
          ...openState,
          phase: "CLOSED",
          position: null,
          unrealizedPnL: null,
          realizedPnL: usd("6514.00"),
          lastPrice: usd("190.00"),
          riskLevel: null,
        }}
      />,
    );

    expect(region("Current return").getByText("+$6,514.00")).toHaveClass(
      "text-(--color-trading-gain)",
    );
    expect(region("Current return").getByText("Closed at $190.00")).toBeVisible();
  });

  it("says no position was opened when the events do not open one", () => {
    render(
      <DecisionIndicators
        decision={decision}
        items={[created]}
        state={{
          ...openState,
          phase: "PLANNED",
          position: null,
          lastPrice: null,
          unrealizedPnL: null,
        }}
      />,
    );

    expect(region("Entry").getByText("No position opened yet")).toBeVisible();
    expect(region("Current return").getByText("—")).toBeVisible();
    expect(
      region("Current return").getByText("No position opened yet · medium risk"),
    ).toBeVisible();
  });

  it("shows a dash and says it is not set for a price the decision does not set", () => {
    render(
      <DecisionIndicators
        decision={{ ...decision, stopPrice: null }}
        items={items}
        state={openState}
      />,
    );

    expect(region("Stop").getByText("—")).toBeVisible();
    expect(region("Stop").getByText("Not set")).toBeVisible();
  });
});

describe("DecisionTimelinePanel", () => {
  it("lists the events in order, each with what it did", () => {
    render(<DecisionTimelinePanel currentIndex={3} items={items} />);

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
    expect(screen.getByText("4 events · the current one is highlighted")).toBeVisible();
  });

  it("marks the current event and dims the ones that have not happened yet", () => {
    render(<DecisionTimelinePanel currentIndex={1} items={items} />);

    const events = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(events.map((event) => event.getAttribute("aria-current"))).toEqual([
      null,
      "step",
      null,
      null,
    ]);
    expect(screen.getByText("Position opened")).toHaveClass("text-(--color-text-default)");
    expect(screen.getByText("Risk changed")).toHaveClass("text-(--color-text-secondary)");
  });

  it("says only what happened when an event has no figures", () => {
    render(
      <DecisionTimelinePanel
        currentIndex={0}
        items={[item({ id: "e1", type: "POSITION_OPENED" })]}
      />,
    );

    expect(screen.getByText("Position opened")).toBeVisible();
    expect(screen.queryByText(/units at/)).not.toBeInTheDocument();
  });

  it("says there are no events yet", () => {
    render(<DecisionTimelinePanel currentIndex={-1} items={[]} />);

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
