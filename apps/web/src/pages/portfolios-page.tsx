import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PortfoliosEmptyState } from "@/features/portfolios/components/portfolios-empty-state";
import { PortfoliosTable } from "@/features/portfolios/components/portfolios-table";
import { PortfoliosTableSkeleton } from "@/features/portfolios/components/portfolios-table-skeleton";
import { PortfoliosToolbar } from "@/features/portfolios/components/portfolios-toolbar";
import { filterPortfolios } from "@/features/portfolios/lib/filter-portfolios";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { usePortfolios } from "@/hooks/use-portfolios";

/**
 * The portfolio list and its five Figma states: loading, with data, empty, no results for the
 * search, and failed. A refetch that fails keeps showing the data it already has.
 */
export function PortfoliosPage() {
  const { t } = useTranslation();
  const { data: portfolios, isError, refetch } = usePortfolios();
  const { active } = useActivePortfolio();
  const [query, setQuery] = useState("");

  const visible = useMemo(
    () => (portfolios === undefined ? [] : filterPortfolios(portfolios, query)),
    [portfolios, query],
  );

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="sr-only">{t("nav.portfolios")}</h1>
      {portfolios === undefined ? null : (
        <p className="text-sm text-(--color-text-secondary)">
          {t("portfolios.summary", { count: portfolios.length })}
        </p>
      )}
      <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
        {portfolios === undefined && isError ? (
          <Alert
            action={
              <Button
                onClick={() => {
                  void refetch();
                }}
                size="sm"
                variant="outline"
              >
                {t("portfolios.failed.retry")}
              </Button>
            }
            description={t("portfolios.failed.description")}
            title={t("portfolios.failed.title")}
            tone="error"
          />
        ) : portfolios === undefined ? (
          <>
            <PortfoliosToolbar count={undefined} onQueryChange={setQuery} query={query} />
            <PortfoliosTableSkeleton />
          </>
        ) : portfolios.length === 0 ? (
          <PortfoliosEmptyState
            description={t("portfolios.empty.description")}
            title={t("portfolios.empty.title")}
          />
        ) : (
          <>
            <PortfoliosToolbar count={visible.length} onQueryChange={setQuery} query={query} />
            <PortfoliosTable activeId={active?.id} portfolios={visible} />
            {visible.length === 0 ? (
              <PortfoliosEmptyState
                action={
                  <Button
                    onClick={() => {
                      setQuery("");
                    }}
                    size="sm"
                    variant="outline"
                  >
                    {t("portfolios.noResults.clear")}
                  </Button>
                }
                description={t("portfolios.noResults.description", { query: query.trim() })}
                title={t("portfolios.noResults.title")}
              />
            ) : (
              <p className="text-sm text-(--color-text-secondary)">
                {t("portfolios.showing", { shown: visible.length, total: portfolios.length })}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
