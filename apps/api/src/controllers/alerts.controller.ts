import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { presentAlert } from "@trading/contracts";
import type { createAlertRequestSchema, updateAlertRequestSchema } from "@trading/contracts";
import type { AlertService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type CreateAlertRequestBody = z.infer<typeof createAlertRequestSchema>;
type UpdateAlertRequestBody = z.infer<typeof updateAlertRequestSchema>;

/** Alert HTTP handlers, bound to the alert use cases they call. */
export function makeAlertsController(alertService: AlertService) {
  /**
   * GET /api/v1/alerts
   * Source: 07-api-spec.md §27 (List Alerts).
   */
  async function listAlertsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const alerts = await alertService.listAlerts(actorOf(req));
      res.json({ data: alerts.map(presentAlert) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/alerts/:alertId
   * Source: 07-api-spec.md §27.
   */
  async function getAlertByIdHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const alert = await alertService.getAlertById(actorOf(req), req.params.alertId as string);
      res.json({ data: presentAlert(alert) });
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
  async function createAlertHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { assetId, portfolioId, type, condition, threshold, enabled } = req.validated
      ?.body as CreateAlertRequestBody;

    try {
      const alert = await alertService.createAlert(actorOf(req), {
        type,
        condition,
        threshold,
        ...(assetId !== undefined ? { assetId } : {}),
        ...(portfolioId !== undefined ? { portfolioId } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      });
      res.status(201).json({ data: presentAlert(alert) });
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
  async function updateAlertHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { condition, threshold, enabled } = req.validated?.body as UpdateAlertRequestBody;

    try {
      const alert = await alertService.updateAlert(actorOf(req), req.params.alertId as string, {
        ...(condition !== undefined ? { condition } : {}),
        ...(threshold !== undefined ? { threshold } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      });
      res.json({ data: presentAlert(alert) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/alerts/:alertId
   * Source: 07-api-spec.md §27 (Delete Alert).
   */
  async function deleteAlertHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await alertService.deleteAlert(actorOf(req), req.params.alertId as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  return {
    listAlertsHandler,
    getAlertByIdHandler,
    createAlertHandler,
    updateAlertHandler,
    deleteAlertHandler,
  };
}
