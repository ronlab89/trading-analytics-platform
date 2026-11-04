import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnalyticsPanel } from "@/features/analytics/components/analytics-panel";
import { PriceChangeBadge } from "@/features/watchlist/components/price-change-badge";
import {
  formatMoney,
  formatPercent,
  formatSignedMoney,
  formatSignedPercent,
} from "@/lib/format-number";
import type { ComparisonView } from "../lib/scenario-comparison";

const pointsOf = (shift: number) => `${formatSignedPercent(shift).slice(0, -1)} pp`;

function Figures({ children }: { children: ReactNode }) {
  return <TableCell className="text-right tabular-nums">{children}</TableCell>;
}

/**
 * The "Diferencias" card: the figures of the base and of each scenario side by side, one column
 * for each letter. Value, return and profit come from the comparison, and so does the weight of
 * every asset with how far it shifts, which stands where the Figma has volatility and
 * concentration: the API has neither. A table that does not fit scrolls inside its card, so five
 * scenarios do not push the page sideways.
 */
export function ComparisonDifferences({ view }: { view: ComparisonView }) {
  const { t } = useTranslation();
  const { columns, assets } = view;

  const unknown = t("scenarios.compare.unknownAsset");

  return (
    <AnalyticsPanel
      subtitle={t("scenarios.compare.differencesDescription")}
      title={t("scenarios.compare.differences")}
    >
      <div className="overflow-x-auto">
        <Table aria-label={t("scenarios.compare.differences")}>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="sr-only">{t("scenarios.compare.figure")}</span>
              </TableHead>
              {columns.map((column) => (
                <TableHead className="text-right" key={column.id}>
                  {column.letter ?? t("scenarios.compare.base")}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableHead className="text-sm font-normal text-(--color-text-default)" scope="row">
                {t("scenarios.compare.value")}
              </TableHead>
              {columns.map((column) => (
                <Figures key={column.id}>
                  <span className="flex flex-col items-end gap-1">
                    <span>{formatMoney(column.value)}</span>
                    {column.letter === null ? null : (
                      <PriceChangeBadge percent={column.valueChangePercent} />
                    )}
                  </span>
                </Figures>
              ))}
            </TableRow>
            <TableRow>
              <TableHead className="text-sm font-normal text-(--color-text-default)" scope="row">
                {t("scenarios.compare.return")}
              </TableHead>
              {columns.map((column) => (
                <Figures key={column.id}>{formatSignedPercent(column.returnPercent)}</Figures>
              ))}
            </TableRow>
            <TableRow>
              <TableHead className="text-sm font-normal text-(--color-text-default)" scope="row">
                {t("scenarios.compare.profit")}
              </TableHead>
              {columns.map((column) => (
                <Figures key={column.id}>{formatSignedMoney(column.profit)}</Figures>
              ))}
            </TableRow>
            {assets.map((asset) => (
              <TableRow key={asset.assetId}>
                <TableHead className="text-sm font-normal text-(--color-text-default)" scope="row">
                  {t("scenarios.compare.weightOf", { asset: asset.symbol ?? unknown })}
                </TableHead>
                <Figures>{formatPercent(asset.base)}</Figures>
                {asset.scenarios.map((entry, index) => (
                  <Figures key={columns[index + 1]?.id ?? index}>
                    <span className="flex flex-col items-end">
                      <span>{formatPercent(entry.weight)}</span>
                      <span className="text-xs text-(--color-text-secondary)">
                        {pointsOf(entry.shift)}
                      </span>
                    </span>
                  </Figures>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AnalyticsPanel>
  );
}
