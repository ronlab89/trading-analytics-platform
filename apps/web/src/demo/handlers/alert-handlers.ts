import { presentAlert, presentNotification, presentSimulationStatus } from "@trading/contracts";
import type {
  ListNotificationsQuery,
  SimulationModeRequestBody,
  createAlertRequestSchema,
  updateAlertRequestSchema,
} from "@trading/contracts";
import type { z } from "zod";
import type { HandlerContext, HandlerRegistry } from "./handler";

type CreateAlertBody = z.infer<typeof createAlertRequestSchema>;
type UpdateAlertBody = z.infer<typeof updateAlertRequestSchema>;

/**
 * Mirrors `alerts.controller.ts`, `notifications.controller.ts` and `simulation.controller.ts` of the
 * API, on the same services.
 */
export function createAlertHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { alertService, notificationService, simulationService, actor } = composition;

  return {
    listAlerts: async () => {
      const alerts = await alertService.listAlerts(actor);
      return { data: alerts.map(presentAlert) };
    },
    getAlert: async ({ params }) => {
      const { alertId } = params as { alertId: string };
      return { data: presentAlert(await alertService.getAlertById(actor, alertId)) };
    },
    createAlert: async ({ body }) => {
      const { assetId, portfolioId, type, condition, threshold, enabled } = body as CreateAlertBody;
      const alert = await alertService.createAlert(actor, {
        type,
        condition,
        threshold,
        ...(assetId !== undefined ? { assetId } : {}),
        ...(portfolioId !== undefined ? { portfolioId } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      });
      return { data: presentAlert(alert) };
    },
    updateAlert: async ({ params, body }) => {
      const { alertId } = params as { alertId: string };
      const { condition, threshold, enabled } = body as UpdateAlertBody;
      const alert = await alertService.updateAlert(actor, alertId, {
        ...(condition !== undefined ? { condition } : {}),
        ...(threshold !== undefined ? { threshold } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      });
      return { data: presentAlert(alert) };
    },
    deleteAlert: async ({ params }) => {
      const { alertId } = params as { alertId: string };
      await alertService.deleteAlert(actor, alertId);
      return undefined;
    },
    listNotifications: async ({ query }) => {
      const { unreadOnly } = query as ListNotificationsQuery;
      const notifications = await notificationService.listNotifications(actor, { unreadOnly });
      return { data: notifications.map(presentNotification) };
    },
    markNotificationRead: async ({ params }) => {
      const { notificationId } = params as { notificationId: string };
      const notification = await notificationService.markNotificationAsRead(actor, notificationId);
      return { data: presentNotification(notification) };
    },
    markAllNotificationsRead: async () => {
      await notificationService.markAllNotificationsAsRead(actor);
      return undefined;
    },
    startSimulation: () =>
      Promise.resolve({ data: presentSimulationStatus(simulationService.startSimulation(actor)) }),
    pauseSimulation: () =>
      Promise.resolve({ data: presentSimulationStatus(simulationService.pauseSimulation(actor)) }),
    setSimulationMode: ({ body }) => {
      const { mode } = body as SimulationModeRequestBody;
      return Promise.resolve({
        data: presentSimulationStatus(simulationService.changeSimulationMode(actor, mode)),
      });
    },
  };
}
