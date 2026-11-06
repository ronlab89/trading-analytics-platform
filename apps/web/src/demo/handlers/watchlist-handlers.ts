import { presentUserPreference, presentWatchlistItem } from "@trading/contracts";
import type {
  AddWatchlistItemRequestBody,
  UpdateUserPreferenceRequestBody,
} from "@trading/contracts";
import type { HandlerContext, HandlerRegistry } from "./handler";

/** Mirrors `watchlist.controller.ts` and `preferences.controller.ts` of the API. */
export function createWatchlistHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { watchlistService, userPreferenceService, actor } = composition;

  return {
    listWatchlist: async () => {
      const items = await watchlistService.listWatchlist(actor);
      return { data: items.map(presentWatchlistItem) };
    },
    addToWatchlist: async ({ body }) => {
      const { assetId } = body as AddWatchlistItemRequestBody;
      return { data: presentWatchlistItem(await watchlistService.addToWatchlist(actor, assetId)) };
    },
    removeFromWatchlist: async ({ params }) => {
      await watchlistService.removeFromWatchlist(actor, (params as { assetId: string }).assetId);
      return undefined;
    },
    getPreferences: async () => {
      const preferences = await userPreferenceService.getUserPreferences(actor);
      return { data: preferences ? presentUserPreference(preferences) : null };
    },
    updatePreferences: async ({ body }) => {
      const { theme, language, defaultPortfolioId, reducedMotion, notificationPreferences } =
        body as UpdateUserPreferenceRequestBody;
      const preferences = await userPreferenceService.updateUserPreferences(actor, {
        ...(theme !== undefined ? { theme } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(defaultPortfolioId !== undefined ? { defaultPortfolioId } : {}),
        ...(reducedMotion !== undefined ? { reducedMotion } : {}),
        ...(notificationPreferences !== undefined ? { notificationPreferences } : {}),
      });
      return { data: presentUserPreference(preferences) };
    },
  };
}
