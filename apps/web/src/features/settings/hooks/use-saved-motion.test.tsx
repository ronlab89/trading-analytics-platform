import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TradingClient } from "@/api/trading-client";
import { useMotionStore } from "@/stores/motion-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useSavedMotion } from "./use-saved-motion";

const preference = (reducedMotion: boolean) => ({
  data: {
    userId: "u1",
    theme: "light",
    language: "en",
    defaultPortfolioId: null,
    reducedMotion,
    notificationPreferences: {},
    updatedAt: "2026-11-01T10:00:00.000Z",
  },
});

function mount(answer: unknown) {
  const client = { call: vi.fn(() => Promise.resolve(answer)) } as unknown as TradingClient;
  return renderHook(
    () => {
      useSavedMotion();
    },
    { wrapper: tradingClientWrapper(client) },
  );
}

beforeEach(() => {
  useMotionStore.setState({ reducedMotion: false });
});

describe("useSavedMotion", () => {
  it("holds the animations when the user saved reduced motion", async () => {
    mount(preference(true));

    await waitFor(() => {
      expect(useMotionStore.getState().reducedMotion).toBe(true);
    });
  });

  it("leaves them on when the user saved the opposite, or nothing yet", async () => {
    useMotionStore.setState({ reducedMotion: true });
    mount({ data: null });

    await waitFor(() => {
      expect(useMotionStore.getState().reducedMotion).toBe(false);
    });
  });
});
