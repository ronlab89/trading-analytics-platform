import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CheckboxItem } from "@/components/ui/checkbox";
import { exchangeLabel } from "@/lib/exchange-label";
import { cn } from "@/lib/utils";
import {
  CATALOG_ASSET_TYPES,
  CATALOG_EXCHANGES,
  NO_CATALOG_FILTERS,
  sameCatalogFilters,
  type CatalogFilters,
} from "../lib/catalog-filters";

interface CatalogFiltersFormProps {
  /** The filters in force; the form starts from them and "Aplicar filtros" waits for a change. */
  value: CatalogFilters;
  onApply: (filters: CatalogFilters) => void;
  onCancel: () => void;
  /**
   * The Figma has two arrangements: the panel (a title with "Limpiar todo", and "Cancelar" next to
   * "Aplicar filtros") and the mobile sheet ("Limpiar" next to "Aplicar filtros").
   */
  layout?: "panel" | "sheet";
}

/**
 * The content of the Figma "Filtros" of the catalog: the type of asset and the exchange. The
 * Figma draws checkboxes, but the API takes one value of each, so choosing another box of a group
 * replaces the one chosen and unchecking it leaves the group open. What is chosen is a draft:
 * nothing narrows the list until "Aplicar filtros", which stays off until the draft asks for
 * something different from what is already in force.
 */
export function CatalogFiltersForm({
  value,
  onApply,
  onCancel,
  layout = "panel",
}: CatalogFiltersFormProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(value);
  const isSheet = layout === "sheet";
  const changed = !sameCatalogFilters(draft, value);
  const clearable = !sameCatalogFilters(draft, NO_CATALOG_FILTERS);

  const clear = () => {
    setDraft(NO_CATALOG_FILTERS);
  };

  return (
    <form
      className="flex flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onApply(draft);
      }}
    >
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="text-sm font-medium text-(--color-text-default)">
          {t("catalogFilters.title")}
        </h2>
        {isSheet ? null : (
          <Button
            className="text-(--color-text-secondary) enabled:text-(--color-text-default)"
            disabled={!clearable}
            onClick={clear}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("catalogFilters.clearAll")}
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-(--color-text-secondary)">
            {t("catalogFilters.assetType")}
          </legend>
          <div className={cn("grid gap-2", isSheet ? "grid-cols-1" : "grid-cols-2")}>
            {CATALOG_ASSET_TYPES.map((assetType) => (
              <CheckboxItem
                checked={draft.assetType === assetType}
                key={assetType}
                label={t(`markets.assetType.${assetType}`)}
                onCheckedChange={(checked) => {
                  setDraft((current) => ({
                    ...current,
                    assetType: checked === true ? assetType : null,
                  }));
                }}
              />
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-(--color-text-secondary)">
            {t("catalogFilters.exchange")}
          </legend>
          <div className={cn("grid gap-2", isSheet ? "grid-cols-1" : "grid-cols-2")}>
            {CATALOG_EXCHANGES.map((exchange) => (
              <CheckboxItem
                checked={draft.exchange === exchange}
                key={exchange}
                label={exchangeLabel(exchange)}
                onCheckedChange={(checked) => {
                  setDraft((current) => ({
                    ...current,
                    exchange: checked === true ? exchange : null,
                  }));
                }}
              />
            ))}
          </div>
        </fieldset>
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-2 border-t border-(--color-border-default) px-4 py-3",
          isSheet && "*:flex-1",
        )}
      >
        {isSheet ? (
          <Button disabled={!clearable} onClick={clear} type="button" variant="ghost">
            {t("catalogFilters.clear")}
          </Button>
        ) : (
          <Button onClick={onCancel} type="button" variant="outline">
            {t("catalogFilters.cancel")}
          </Button>
        )}
        <Button disabled={!changed} type="submit">
          {t("catalogFilters.apply")}
        </Button>
      </div>
    </form>
  );
}
