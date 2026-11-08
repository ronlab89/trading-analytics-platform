import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { rejectionReason } from "@/api/rejection-reason";
import type { AlertRow } from "../lib/alert-row";
import { useUpdateAlert } from "./use-update-alert";

/**
 * Pauses an enabled alert and resumes a paused one, and says which in a toast; a failure says so
 * with its reason. The function is stable, so it can sit in the columns of a table.
 */
export function useToggleAlert() {
  const { t } = useTranslation();
  const { mutate } = useUpdateAlert();

  return useCallback(
    (alert: AlertRow) => {
      const enabled = !alert.enabled;
      mutate(
        { alertId: alert.id, body: { enabled } },
        {
          onSuccess: () => {
            toast.success(t(enabled ? "alerts.toggled.resumed" : "alerts.toggled.paused"));
          },
          onError: (error) => {
            toast.error(t("alerts.toggled.failed"), {
              description: rejectionReason(error) ?? t("alerts.toggled.failedDescription"),
            });
          },
        },
      );
    },
    [mutate, t],
  );
}
