import { useCallback, useState } from "react";
import { useToggleAlert } from "../hooks/use-toggle-alert";
import type { AlertRow } from "../lib/alert-row";
import { AlertFormDialog } from "./alert-form-dialog";
import { AlertRowMenu } from "./alert-row-menu";
import { AlertsSection } from "./alerts-section";
import { DeleteAlertDialog } from "./delete-alert-dialog";

/**
 * The content of the Alerts tab: the list, and the dialogs its actions open. "Create alert" and
 * "Edit" share one form dialog; "Delete" asks first; "Pause" and "Resume" act at once. The alert of
 * a dialog is kept after it closes, so the dialog does not go blank while it fades out.
 */
export function AlertsTab() {
  const [form, setForm] = useState<{ open: boolean; alert?: AlertRow }>({ open: false });
  const [deleting, setDeleting] = useState<{ open: boolean; alert: AlertRow | null }>({
    open: false,
    alert: null,
  });
  const toggle = useToggleAlert();

  const renderAction = useCallback(
    (alert: AlertRow) => (
      <AlertRowMenu
        alert={alert}
        onDelete={(target) => {
          setDeleting({ open: true, alert: target });
        }}
        onEdit={(target) => {
          setForm({ open: true, alert: target });
        }}
        onToggle={toggle}
      />
    ),
    [toggle],
  );

  return (
    <>
      <AlertsSection
        onCreate={() => {
          setForm({ open: true });
        }}
        renderAction={renderAction}
      />
      <AlertFormDialog
        alert={form.alert}
        onOpenChange={(open) => {
          setForm((current) => ({ ...current, open }));
        }}
        open={form.open}
      />
      <DeleteAlertDialog
        alert={deleting.alert}
        onOpenChange={(open) => {
          setDeleting((current) => ({ ...current, open }));
        }}
        open={deleting.open}
      />
    </>
  );
}
