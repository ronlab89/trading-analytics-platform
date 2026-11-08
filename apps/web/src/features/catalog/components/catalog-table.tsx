import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DataTable } from "@/components/data-table/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import { AssetRowActions } from "@/features/alerts/components/asset-row-actions";
import { useAssetColumns } from "@/features/watchlist/hooks/use-asset-columns";
import type { CatalogRow } from "../types";
import { CatalogStarButton } from "./catalog-star-button";

function assetId(row: CatalogRow) {
  return row.assetId;
}

/**
 * The page of the catalog on screen, as a table. The server pages the list and the API gives the
 * order, so the table neither pages nor sorts: it draws the rows it is given. The search, the
 * pagination and the loading, empty and error states belong to the section. `onToggle` and
 * `onCreateAlert` must be stable, or the columns rebuild.
 */
export function CatalogTable({
  rows,
  onToggle,
  canToggle,
  onCreateAlert,
}: {
  rows: readonly CatalogRow[];
  onToggle: (row: CatalogRow) => void;
  canToggle: boolean;
  onCreateAlert?: (assetId: string) => void;
}) {
  const { t } = useTranslation();
  const renderAction = useCallback(
    (row: CatalogRow) => (
      <AssetRowActions asset={row} onCreateAlert={onCreateAlert}>
        <CatalogStarButton disabled={!canToggle} onToggle={onToggle} row={row} />
      </AssetRowActions>
    ),
    [canToggle, onToggle, onCreateAlert],
  );
  const table = useDataTable({
    columns: useAssetColumns(renderAction),
    data: rows,
    getRowId: assetId,
  });

  return <DataTable aria-label={t("markets.catalogTable")} table={table} />;
}
