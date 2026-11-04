import type { DecisionResponse } from "@trading/contracts";
import type { TFunction } from "i18next";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AnalyticsPanel,
  AnalyticsPanelLoading,
} from "@/features/analytics/components/analytics-panel";
import { formatMomentDay } from "@/lib/format-date";
import { formatMoney, formatSignedPercent } from "@/lib/format-number";
import { useDecisionHistory } from "../hooks/use-decision-history";
import { expectedVsActual, type ExpectedVsActual } from "../lib/expected-vs-actual";
import { toPriceSeries } from "../lib/price-series";

const DASH = "—";

interface DecisionExpectedPanelProps {
  decision: DecisionResponse;
  currency: string;
  /** When the event the replay is on happened; null without events. */
  currentTimestamp: string | null;
  /** When the position was opened; null while no event opens one. */
  openedAt: string | null;
}

interface Line {
  key: "direction" | "target" | "risk" | "result";
  expected: string;
  actual: string;
}

function linesOf(rows: ExpectedVsActual, currency: string, t: TFunction): Line[] {
  const money = (amount: number) => formatMoney({ amount: String(amount), currency });
  const { direction, target, risk, result } = rows;

  const progress =
    target.price === null
      ? DASH
      : target.progress === null
        ? money(target.price)
        : t("decisions.detail.expected.progress", {
            price: money(target.price),
            percent: Math.round(target.progress),
          });
  const worstFall =
    risk.actual.kind === "none"
      ? DASH
      : risk.actual.kind === "calm"
        ? t("decisions.detail.expected.noDrop")
        : t("decisions.detail.expected.maxDrop", {
            percent: formatSignedPercent(risk.actual.percent),
          });
  const percent = (value: number | null) => (value === null ? DASH : formatSignedPercent(value));

  return [
    {
      key: "direction",
      expected: t(`decisions.direction.${direction.expected}`),
      actual:
        direction.actual === null ? DASH : t(`decisions.detail.expected.moves.${direction.actual}`),
    },
    {
      key: "target",
      expected: target.expected === null ? DASH : formatMoney(target.expected),
      actual: progress,
    },
    {
      key: "risk",
      expected:
        risk.expected === null
          ? DASH
          : t(`decisions.detail.risk.${risk.expected}`, { defaultValue: risk.expected }),
      actual: worstFall,
    },
    { key: "result", expected: percent(result.expected), actual: percent(result.actual) },
  ];
}

/**
 * The Figma "Esperado vs real": what the decision set out to do beside what the price has done up to
 * the event the replay is on, in four rows. It reads the same price history as the chart, so it moves
 * with the player. While the history loads the panel holds its place, and when it fails the expected
 * column stays and the real one says why it is empty: the retry is on the price panel, which asks for
 * the same data.
 */
export function DecisionExpectedPanel({
  decision,
  currency,
  currentTimestamp,
  openedAt,
}: DecisionExpectedPanelProps) {
  const { t, i18n } = useTranslation();
  const { history } = useDecisionHistory(decision);
  const lines = useMemo(() => {
    const { points, cursor } = toPriceSeries(history.data ?? [], currentTimestamp);
    return linesOf(expectedVsActual({ decision, points, cursor, openedAt }), currency, t);
  }, [history.data, currentTimestamp, decision, openedAt, currency, t]);

  if (currentTimestamp === null) return null;

  return (
    <AnalyticsPanel
      busy={history.isPending}
      subtitle={t("decisions.detail.expected.subtitle", {
        date: formatMomentDay(currentTimestamp, i18n.language),
      })}
      title={t("decisions.detail.expected.title")}
    >
      {history.isPending ? (
        <AnalyticsPanelLoading label={t("decisions.detail.expected.loading")} />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-0">
                  <span className="sr-only">{t("decisions.detail.expected.measure")}</span>
                </TableHead>
                <TableHead className="text-right">
                  {t("decisions.detail.expected.expected")}
                </TableHead>
                <TableHead className="pr-0 text-right">
                  {t("decisions.detail.expected.actual")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.key}>
                  <TableHead
                    className="pl-0 text-sm font-medium text-(--color-text-default)"
                    scope="row"
                  >
                    {t(`decisions.detail.expected.rows.${line.key}`)}
                  </TableHead>
                  <TableCell className="text-right text-(--color-text-default)">
                    {line.expected}
                  </TableCell>
                  <TableCell className="pr-0 text-right text-(--color-text-default)">
                    {line.actual}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {history.isError ? (
            <p className="text-xs text-(--color-text-secondary)">
              {t("decisions.detail.expected.unavailable")}
            </p>
          ) : null}
        </>
      )}
    </AnalyticsPanel>
  );
}
