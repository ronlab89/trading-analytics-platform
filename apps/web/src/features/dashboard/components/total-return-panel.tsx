import type { MoneyDto } from "@trading/contracts";
import { ArrowDownRight, ArrowUpRight, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatSignedMoney, formatSignedPercent } from "@/lib/format-number";

interface TotalReturnPanelProps {
  /** The unrealized profit or loss of the open positions. */
  profit: MoneyDto;
  /** The same, in percentage points over what the positions cost. */
  percent: number;
  /** The portfolio holds no positions, so there is no return to show. */
  empty: boolean;
}

/** The slope that joins the Figma folder tab to the card: a 14 px wide ramp down to the body. */
const SLOPE = "[clip-path:polygon(0_0,0_100%,100%_100%)]";

/**
 * The Figma "Retorno total": an orange folder card with the profit of the open positions and the
 * percentage it represents. The Figma captions it "since the start of the portfolio", but the
 * figure is the unrealized result (what was already sold is not in it), so the caption says that.
 */
export function TotalReturnPanel({ profit, percent, empty }: TotalReturnPanelProps) {
  const { t } = useTranslation();
  const label = t("dashboard.totalReturn.title");

  return (
    <section aria-label={label} className="flex flex-col">
      <div className="flex h-6 items-end">
        <span className="flex h-6 items-center rounded-tl-lg bg-(--color-brand-brand-gradient-from) pr-2 pl-3 text-xs font-semibold text-(--color-text-default)">
          {label}
        </span>
        <span
          aria-hidden="true"
          className={`h-6 w-3.5 bg-(--color-brand-brand-gradient-from) ${SLOPE}`}
        />
      </div>
      <div className="flex min-h-72 flex-1 flex-col gap-4 rounded-b-xl rounded-tr-xl bg-linear-to-br from-(--color-brand-brand-gradient-from) to-(--color-brand-brand) p-6 text-(--color-text-default)">
        {empty ? <EmptyReturn /> : <Return percent={percent} profit={profit} />}
      </div>
    </section>
  );
}

function EmptyReturn() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <span
        aria-hidden="true"
        className="mb-1 flex size-12 items-center justify-center rounded-full bg-(--color-brand-brand)"
      >
        <Inbox className="size-5" />
      </span>
      <h3 className="text-sm font-medium">{t("dashboard.totalReturn.empty.title")}</h3>
      <p className="max-w-60 text-sm">{t("dashboard.totalReturn.empty.description")}</p>
    </div>
  );
}

function Return({ profit, percent }: Pick<TotalReturnPanelProps, "profit" | "percent">) {
  const { t } = useTranslation();
  const direction = Math.sign(Number(profit.amount));
  const Icon = direction < 0 ? ArrowDownRight : ArrowUpRight;
  const key = direction > 0 ? "gain" : direction < 0 ? "loss" : "flat";

  return (
    <div className="flex flex-1 flex-col justify-end gap-3">
      <p className="text-4xl leading-tight font-medium tracking-tight desktop:text-5xl">
        {formatSignedMoney(profit)}
      </p>
      <p className="flex h-7 items-center gap-1 rounded-md bg-(--color-brand-brand-overlay) px-3 text-sm">
        <Icon aria-hidden="true" className="size-3.5" />
        {t(`dashboard.totalReturn.${key}`, { percent: formatSignedPercent(percent) })}
      </p>
      <p className="text-xs">{t("dashboard.totalReturn.caption")}</p>
    </div>
  );
}
