import type { NextFunction, Request, Response } from "express";
import type { UpdateUserPreferenceRequestBody } from "../schemas/user-preference.schema.js";
import { getUserPreferences, updateUserPreferences } from "../services/user-preference.service.js";

/**
 * GET /api/v1/preferences
 * Source: 07-api-spec.md §29 (Get Preferences).
 *
 * Responds 200 with `data: null` when the user has never saved
 * preferences — absence is a valid state, not a 404 (see service).
 */
export async function getUserPreferencesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const preferences = await getUserPreferences(req.auth.userId);
    res.json({ data: preferences });
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
export async function updateUserPreferencesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { theme, language, defaultPortfolioId, reducedMotion, notificationPreferences } = req
    .validated?.body as UpdateUserPreferenceRequestBody;

  try {
    const preferences = await updateUserPreferences(req.auth.userId, {
      ...(theme !== undefined ? { theme } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(defaultPortfolioId !== undefined ? { defaultPortfolioId } : {}),
      ...(reducedMotion !== undefined ? { reducedMotion } : {}),
      ...(notificationPreferences !== undefined ? { notificationPreferences } : {}),
    });
    res.json({ data: preferences });
  } catch (error) {
    next(error);
  }
}
