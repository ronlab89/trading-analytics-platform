import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/format-number";
import type { ScenarioRow } from "../types";

/**
 * The line over the list of the Lab: how many scenarios are saved and the portfolio they start from,
 * with its value once a calculation has come back. Every calculation starts from the same base, so
 * the first one that is in tells it. Nothing to count, nothing to say.
 */
export function ScenariosSummary({
  rows,
  portfolioName,
}: {
  rows: readonly ScenarioRow[] | undefined;
  portfolioName: string;
}) {
  const { t } = useTranslation();

  if (rows === undefined || rows.length === 0) return null;

  const saved = rows.filter((row) => row.status === "SAVED").length;
  const base = rows.find((row) => row.figures !== null)?.figures?.base;

  return (
    <p className="text-sm text-(--color-text-secondary)">
      {t("scenarios.summary.saved", { count: saved })} ·{" "}
      {base === undefined
        ? t("scenarios.summary.base", { portfolio: portfolioName })
        : t("scenarios.summary.baseValue", { portfolio: portfolioName, value: formatMoney(base) })}
    </p>
  );
}
