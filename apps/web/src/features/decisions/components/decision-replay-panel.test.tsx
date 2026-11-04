import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { useReplayPlayer } from "../hooks/use-replay-player";
import type { TimelineItem } from "../lib/event-timeline";
import { DecisionReplayPanel } from "./decision-replay-panel";

const item = (id: string, timestamp: string): TimelineItem => ({
  id,
  type: "NOTE_ADDED",
  timestamp,
  quantity: null,
  price: null,
  riskLevel: null,
  text: null,
});

const items = [
  item("e1", "2026-08-12T15:00:00.000Z"),
  item("e2", "2026-08-14T15:00:00.000Z"),
  item("e3", "2026-08-28T15:00:00.000Z"),
];

function Harness({ events = items }: { events?: readonly TimelineItem[] }) {
  const player = useReplayPlayer(events.length);
  return <DecisionReplayPanel items={events} player={player} />;
}

const button = (name: string) => screen.getByRole("button", { name });

describe("DecisionReplayPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens at the end of the replay, ready to start over", () => {
    render(<Harness />);

    expect(screen.getByRole("heading", { name: "Replay" })).toBeVisible();
    expect(screen.getByText("End of the replay · event 3 of 3 · Aug 28, 2026")).toBeVisible();
    expect(screen.getByText("Aug 28")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Replay progress" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    expect(button("Replay from the start")).toBeEnabled();
    expect(button("Previous event")).toBeEnabled();
    expect(button("Next event")).toBeDisabled();
  });

  it("plays, says so, and offers to pause", () => {
    render(<Harness />);

    fireEvent.click(button("Replay from the start"));
    expect(screen.getByText("Playing · event 1 of 3 · Aug 12, 2026")).toBeVisible();
    expect(button("Previous event")).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("Playing · event 2 of 3 · Aug 14, 2026")).toBeVisible();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

    fireEvent.click(button("Pause"));
    expect(
      screen.getByText("Event 2 of 3 · Aug 14, 2026 · the history is not changed"),
    ).toBeVisible();
    expect(button("Play")).toBeEnabled();
  });

  it("moves one event with previous and next", () => {
    render(<Harness />);

    fireEvent.click(button("Previous event"));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");

    fireEvent.click(button("Next event"));
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
  });

  it("marks the chosen speed and plays at it", () => {
    render(<Harness />);
    expect(button("1×")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button("2×"));
    expect(button("2×")).toHaveAttribute("aria-pressed", "true");
    expect(button("1×")).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button("Replay from the start"));
    act(() => {
      vi.advanceTimersByTime(750);
    });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
  });

  it("has nothing to start over with a single event", () => {
    render(<Harness events={[item("e1", "2026-08-12T15:00:00.000Z")]} />);

    expect(button("Replay from the start")).toBeDisabled();
    expect(button("Previous event")).toBeDisabled();
    expect(button("Next event")).toBeDisabled();
  });

  it("on a phone leaves the bar on its own line, with larger buttons and a shorter sentence", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    render(<Harness />);

    fireEvent.click(button("Previous event"));

    expect(screen.getByText("Event 2 of 3 · Aug 14, 2026")).toBeVisible();
    expect(button("Play")).toHaveClass("size-10");
    expect(button("Next event")).toHaveClass("size-10");
    const bar = screen.getByRole("progressbar");
    expect(bar.parentElement).not.toContainElement(button("Play"));
    vi.unstubAllGlobals();
  });

  it("is not drawn when there are no events", () => {
    render(<Harness events={[]} />);

    expect(screen.queryByRole("heading", { name: "Replay" })).not.toBeInTheDocument();
  });
});
