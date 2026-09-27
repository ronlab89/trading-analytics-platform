import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type {
  createAlertRequestSchema,
  updateAlertRequestSchema,
} from "../schemas/alert.schema.js";
import {
  createAlert,
  deleteAlert,
  getAlertById,
  listAlerts,
  updateAlert,
} from "../services/alert.service.js";

type CreateAlertRequestBody = z.infer<typeof createAlertRequestSchema>;
type UpdateAlertRequestBody = z.infer<typeof updateAlertRequestSchema>;

/**
 * GET /api/v1/alerts
 * Source: 07-api-spec.md §27 (List Alerts).
 */
export async function listAlertsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alerts = await listAlerts(req.auth.userId);
    res.json({ data: alerts });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/alerts/:alertId
 * Source: 07-api-spec.md §27.
 */
export async function getAlertByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const alert = await getAlertById(req.auth.userId, req.params.alertId as string);
    res.json({ data: alert });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/alerts
 * Source: 07-api-spec.md §27 (Create Alert), FR-053.
 *
 * Body validated upstream by `validate(createAlertRequestSchema, "body")`.
 */
export async function createAlertHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { assetId, portfolioId, type, condition, threshold, enabled } = req.validated
    ?.body as CreateAlertRequestBody;

  try {
    const alert = await createAlert(req.auth.userId, {
      type,
      condition,
      threshold,
      ...(assetId !== undefined ? { assetId } : {}),
      ...(portfolioId !== undefined ? { portfolioId } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    });
    res.status(201).json({ data: alert });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/v1/alerts/:alertId
 * Source: 07-api-spec.md §27 (Update Alert).
 *
 * Body validated upstream by `validate(updateAlertRequestSchema, "body")`.
 */
export async function updateAlertHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { condition, threshold, enabled } = req.validated?.body as UpdateAlertRequestBody;

  try {
    const alert = await updateAlert(req.auth.userId, req.params.alertId as string, {
      ...(condition !== undefined ? { condition } : {}),
      ...(threshold !== undefined ? { threshold } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    });
    res.json({ data: alert });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/alerts/:alertId
 * Source: 07-api-spec.md §27 (Delete Alert).
 */
export async function deleteAlertHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteAlert(req.auth.userId, req.params.alertId as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
