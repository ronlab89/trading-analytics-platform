import type { NextFunction, Request, Response } from "express";
import { presentUserPreference } from "@trading/contracts";
import type { UpdateUserPreferenceRequestBody } from "@trading/contracts";
import type { UserPreferenceService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

/** Preference HTTP handlers, bound to the preference use cases they call. */
export function makePreferencesController(userPreferenceService: UserPreferenceService) {
  /**
   * GET /api/v1/preferences
   * Source: 07-api-spec.md §29 (Get Preferences).
   *
   * Responds 200 with `data: null` when the user has never saved
   * preferences — absence is a valid state, not a 404 (see service).
   */
  async function getUserPreferencesHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const preferences = await userPreferenceService.getUserPreferences(actorOf(req));
      res.json({ data: preferences ? presentUserPreference(preferences) : null });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/preferences
   * Source: 07-api-spec.md §29 (Update Preferences).
   *
   * Body validated upstream by `validate(updateUserPreferenceRequestSchema, "body")`.
   */
  async function updateUserPreferencesHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { theme, language, defaultPortfolioId, reducedMotion, notificationPreferences } = req
      .validated?.body as UpdateUserPreferenceRequestBody;

    try {
      const preferences = await userPreferenceService.updateUserPreferences(actorOf(req), {
        ...(theme !== undefined ? { theme } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(defaultPortfolioId !== undefined ? { defaultPortfolioId } : {}),
        ...(reducedMotion !== undefined ? { reducedMotion } : {}),
        ...(notificationPreferences !== undefined ? { notificationPreferences } : {}),
      });
      res.json({ data: presentUserPreference(preferences) });
    } catch (error) {
      next(error);
    }
  }

  return { getUserPreferencesHandler, updateUserPreferencesHandler };
}
