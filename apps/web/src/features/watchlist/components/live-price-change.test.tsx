import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@/i18n";
import { TICK_FLASH_MS } from "@/hooks/use-tick-flash";
import { useMotionStore } from "@/stores/motion-store";
import { LivePriceChange } from "./live-price-change";
import { PriceChangeBadge } from "./price-change-badge";

const usd = (amount: string) => ({ amount, currency: "USD" });

beforeEach(() => {
  vi.useFakeTimers();
  useMotionStore.setState(useMotionStore.getInitialState());
});
afterEach(() => {
  vi.useRealTimers();
});

const isSolid = (element: HTMLElement) => element.className.includes("-solid-");
const isSubtle = (element: HTMLElement) => element.className.includes("-subtle-");

describe("PriceChangeBadge solid", () => {
  it("is subtle by default and solid on request, with the same text and arrow", () => {
    const { rerender } = render(<PriceChangeBadge percent={2.6} />);
    const badge = screen.getByText("+2.60%");
    expect(isSubtle(badge)).toBe(true);

    rerender(<PriceChangeBadge percent={2.6} solid />);

    expect(isSolid(screen.getByText("+2.60%"))).toBe(true);
    expect(screen.getByText("+2.60%").querySelector("svg")).not.toBeNull();
  });
});

describe("LivePriceChange", () => {
  it("is subtle at first, goes solid for a second when the price ticks, then subtle again", () => {
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
    );
    expect(isSubtle(screen.getByText("+2.10%"))).toBe(true);

    rerender(<LivePriceChange assetId="a1" percent={2.6} price={usd("181.20")} />);
    expect(isSolid(screen.getByText("+2.60%"))).toBe(true);

    act(() => {
      vi.advanceTimersByTime(TICK_FLASH_MS);
    });
    expect(isSubtle(screen.getByText("+2.60%"))).toBe(true);
  });

  it("flashes when only the price moves and the change stays", () => {
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
    );

    rerender(<LivePriceChange assetId="a1" percent={2.1} price={usd("180.71")} />);

    expect(isSolid(screen.getByText("+2.10%"))).toBe(true);
  });

  it("does not flash when the user chose reduced motion", () => {
    useMotionStore.setState({ reducedMotion: true });
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={2.1} price={usd("180.70")} />,
    );

    rerender(<LivePriceChange assetId="a1" percent={2.6} price={usd("181.20")} />);

    expect(isSubtle(screen.getByText("+2.60%"))).toBe(true);
  });

  it("keeps the sign in the text while it flashes, so the color is never alone", () => {
    const { rerender } = render(
      <LivePriceChange assetId="a1" percent={-1} price={usd("180.70")} />,
    );

    rerender(<LivePriceChange assetId="a1" percent={-1.4} price={usd("178.00")} />);

    const badge = screen.getByText("-1.40%");
    expect(isSolid(badge)).toBe(true);
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("shows a dash for an unknown change", () => {
    render(<LivePriceChange assetId="a1" percent={null} price={null} />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
