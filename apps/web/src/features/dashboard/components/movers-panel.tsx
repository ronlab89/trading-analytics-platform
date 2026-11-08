import { useTranslation } from "react-i18next";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { formatSignedPercent } from "@/lib/format-number";
import { cn } from "@/lib/utils";
import type { Mover } from "../lib/top-movers";
import { DirectionMark } from "./direction-mark";

interface MoversPanelProps {
  /** The biggest moves of the day, biggest first. */
  movers: readonly Mover[];
}

/**
 * The Figma "Mayores movimientos": one bar per position, growing to the right from a dashed zero
 * line when it gained and to the left when it lost, with its percentage, sign and arrow at the
 * end. The lengths are relative to the biggest gain and the biggest loss, so both sides use the
 * space they need. There is no axis: every bar is labelled.
 */
export function MoversPanel({ movers }: MoversPanelProps) {
  const { t } = useTranslation();
  const gainExtent = Math.max(0, ...movers.map((m) => m.percent));
  const lossExtent = Math.max(0, ...movers.map((m) => -m.percent));
  const total = gainExtent + lossExtent;
  const zero = total === 0 ? 0 : (lossExtent / total) * 100;

  return (
    <section
      aria-labelledby="dashboard-movers-title"
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-5"
    >
      <div className="flex flex-col gap-1">
        <h2
          className="text-lg leading-6 font-medium text-(--color-text-default)"
          id="dashboard-movers-title"
        >
          {t("dashboard.movers.title")}
        </h2>
        <p className="text-xs text-(--color-text-secondary)">{t("dashboard.movers.subtitle")}</p>
      </div>
      {movers.length === 0 ? (
        <PortfoliosEmptyState
          description={t("dashboard.movers.empty.description")}
          title={t("dashboard.movers.empty.title")}
        />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {movers.map(({ symbol, percent }) => {
            const loss = percent < 0;
            const width = total === 0 ? 0 : (Math.abs(percent) / total) * 100;
            return (
              <li className="grid grid-cols-[4rem_1fr_5.5rem] items-center gap-3" key={symbol}>
                <span className="text-sm text-(--color-text-default)">{symbol}</span>
                <span aria-hidden="true" className="relative h-5">
                  <span
                    className="absolute inset-y-[-6px] border-l border-dashed border-(--color-chart-axis)"
                    style={{ left: `${String(zero)}%` }}
                  />
                  <span
                    className={cn(
                      "absolute inset-y-0 rounded-md",
                      loss ? "bg-(--color-chart-loss)" : "bg-(--color-chart-gain)",
                    )}
                    style={{
                      width: `${String(width)}%`,
                      left: `${String(loss ? zero - width : zero)}%`,
                    }}
                  />
                </span>
                <span
                  className={cn(
                    "text-right text-xs font-medium",
                    loss ? "text-(--color-trading-loss)" : "text-(--color-trading-gain)",
                  )}
                >
                  <DirectionMark percent={percent} /> {formatSignedPercent(percent)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
