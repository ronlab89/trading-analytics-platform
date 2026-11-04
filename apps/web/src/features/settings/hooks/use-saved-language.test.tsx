import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TradingClient } from "@/api/trading-client";
import { DEFAULT_LANGUAGE } from "@/i18n/resources";
import { useLanguageStore } from "@/stores/language-store";
import { tradingClientWrapper } from "@/test/trading-client-wrapper";
import { useSavedLanguage } from "./use-saved-language";

const other = DEFAULT_LANGUAGE === "es" ? "en" : "es";

const preference = (language: string) => ({
  data: {
    userId: "u1",
    theme: "light",
    language,
    defaultPortfolioId: null,
    reducedMotion: false,
    notificationPreferences: {},
    updatedAt: "2026-11-01T10:00:00.000Z",
  },
});

function mount(answer: unknown) {
  const client = { call: vi.fn(() => Promise.resolve(answer)) } as unknown as TradingClient;
  return renderHook(
    () => {
      useSavedLanguage();
    },
    { wrapper: tradingClientWrapper(client) },
  );
}

beforeEach(() => {
  useLanguageStore.setState({ language: DEFAULT_LANGUAGE });
});

describe("useSavedLanguage", () => {
  it("switches the app to the language the user saved", async () => {
    mount(preference(other));

    await waitFor(() => {
      expect(useLanguageStore.getState().language).toBe(other);
    });
  });

  it("leaves the language alone when nothing was saved yet", async () => {
    mount({ data: null });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useLanguageStore.getState().language).toBe(DEFAULT_LANGUAGE);
  });

  it("ignores a language the app does not have", async () => {
    mount(preference("fr"));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(useLanguageStore.getState().language).toBe(DEFAULT_LANGUAGE);
  });
});
