import { useTranslation } from "react-i18next";
import { useCatalogAssets } from "../hooks/use-catalog-assets";

/**
 * The header line of the "Todos los activos" tab: how many assets there are in all. It asks for
 * a page of one, as only the server's count matters, and does not follow the table's search or
 * filters: it is the size of the catalog, not of what is on screen.
 */
export function CatalogSummary() {
  const { t } = useTranslation();
  const { data } = useCatalogAssets({ page: 1, pageSize: 1 });

  if (data === undefined) return null;
  return (
    <p className="text-sm text-(--color-text-secondary)">
      {t("markets.catalogSummary", { count: data.meta.total })}
    </p>
  );
}
