import type { MoneyDto } from "@trading/contracts";
import { ArrowDownRight, ArrowUpRight, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Badge } from "@/components/badge";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { formatMoney, formatSignedMoney, formatSignedPercent } from "@/lib/format-number";

interface PortfolioValuePanelProps {
  /** The first name of the user, or an empty string when the account has none. */
  firstName: string;
  portfolioId: string;
  totalValue: MoneyDto;
  /** Today's change; null when the API could not work it out (no prices for the day yet). */
  dailyChange: { changeValue: MoneyDto; changePercent: number } | null;
  /** The portfolio holds no positions, so there is no value to show. */
  empty: boolean;
  onNew: () => void;
}

/**
 * The Figma "Hola, Jane": a greeting, the value of the portfolio and how much it moved today. The
 * monthly bars the Figma draws under them are charts and arrive with FE2.2. An empty portfolio
 * shows the Figma empty state with the way to its first transaction instead.
 */
export function PortfolioValuePanel({
  firstName,
  portfolioId,
  totalValue,
  dailyChange,
  empty,
  onNew,
}: PortfolioValuePanelProps) {
  const { t } = useTranslation();
  const title = firstName
    ? t("dashboard.value.greeting", { name: firstName })
    : t("dashboard.value.greetingAnonymous");

  return (
    <section
      aria-labelledby="dashboard-value-title"
      className="flex min-h-72 flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2
            className="text-lg leading-6 font-medium text-(--color-text-default)"
            id="dashboard-value-title"
          >
            {title}
          </h2>
          <p className="text-xs text-(--color-text-secondary)">{t("dashboard.value.subtitle")}</p>
        </div>
        {empty ? null : (
          <Button asChild size="icon-md" variant="outline">
            <Link
              aria-label={t("dashboard.value.view")}
              to={`/portfolios/${encodeURIComponent(portfolioId)}`}
            >
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>
      {empty ? (
        <PortfoliosEmptyState
          action={
            <Button onClick={onNew} size="sm" variant="outline">
              <Plus aria-hidden="true" />
              {t("transactions.new")}
            </Button>
          }
          description={t("dashboard.value.empty.description")}
          title={t("dashboard.value.empty.title")}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-4xl leading-tight font-medium tracking-tight text-(--color-text-default) desktop:text-5xl">
            {formatMoney(totalValue)}
          </p>
          {dailyChange ? <DailyChange change={dailyChange} /> : null}
        </div>
      )}
    </section>
  );
}

function DailyChange({ change }: { change: { changeValue: MoneyDto; changePercent: number } }) {
  const { t } = useTranslation();
  const direction = Math.sign(Number(change.changeValue.amount));
  const Icon = direction < 0 ? ArrowDownRight : ArrowUpRight;
  const tone = direction > 0 ? "success" : direction < 0 ? "error" : "neutral";

  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-(--color-text-default)">
      <Badge tone={tone}>
        <Icon aria-hidden="true" className="size-3.5" />
        {formatSignedPercent(change.changePercent)}
      </Badge>
      <span className="font-medium">{formatSignedMoney(change.changeValue)}</span>
      <span className="text-(--color-text-secondary)">{t("dashboard.value.today")}</span>
    </p>
  );
}
