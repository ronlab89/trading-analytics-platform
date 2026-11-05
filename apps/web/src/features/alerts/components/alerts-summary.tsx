import { useTranslation } from "react-i18next";
import { useAlertRows } from "../hooks/use-alert-rows";

/** The header line of the Alerts tab: how many price alerts the user has. It waits for the list. */
export function AlertsSummary() {
  const { t } = useTranslation();
  const { rows } = useAlertRows();

  if (rows === undefined) return null;
  return (
    <p className="text-sm text-(--color-text-secondary)">
      {t("alerts.summary", { count: rows.length })}
    </p>
  );
}
