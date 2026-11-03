import { useTranslation } from "react-i18next";
import { exchangeLabel } from "@/lib/exchange-label";
import { useCatalogAssets } from "../hooks/use-catalog-assets";
import { NO_CATALOG_FILTERS, type CatalogFilters } from "../lib/catalog-filters";

/**
 * The header line of the "Todos los activos" tab: how many assets there are, and of which type or
 * exchange when the filters narrow them ("2 activos de tipo ETF"). It asks for a page of one, as
 * only the server's count matters, and does not follow the search box: that has its own results.
 */
export function CatalogSummary({ filters = NO_CATALOG_FILTERS }: { filters?: CatalogFilters }) {
  const { t } = useTranslation();
  const { data } = useCatalogAssets({ page: 1, pageSize: 1 }, filters);

  if (data === undefined) return null;

  const type = filters.assetType === null ? null : t(`markets.assetType.${filters.assetType}`);
  const exchange = filters.exchange === null ? null : exchangeLabel(filters.exchange);
  const summary = (count: number) => {
    if (type !== null && exchange !== null) {
      return t("markets.catalogSummaryTypeExchange", { count, type, exchange });
    }
    if (type !== null) return t("markets.catalogSummaryType", { count, type });
    if (exchange !== null) return t("markets.catalogSummaryExchange", { count, exchange });
    return t("markets.catalogSummary", { count });
  };
  return <p className="text-sm text-(--color-text-secondary)">{summary(data.meta.total)}</p>;
}
