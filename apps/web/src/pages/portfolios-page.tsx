import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { PortfoliosTable } from "@/features/portfolios/components/portfolios-table";
import { filterPortfolios } from "@/features/portfolios/lib/filter-portfolios";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { usePortfolios } from "@/hooks/use-portfolios";

/**
 * The portfolio list. Loading, empty, no-results and failed states arrive in the next task, so
 * until then nothing is drawn while the list is not there.
 */
export function PortfoliosPage() {
  const { t } = useTranslation();
  const { data: portfolios } = usePortfolios();
  const { active } = useActivePortfolio();
  const [query, setQuery] = useState("");

  if (portfolios === undefined) return null;

  const visible = filterPortfolios(portfolios, query);

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="sr-only">{t("nav.portfolios")}</h1>
      <p className="text-sm text-(--color-text-secondary)">
        {t("portfolios.summary", { count: portfolios.length })}
      </p>
      <section className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-70 max-w-full">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-text-secondary)"
            />
            <Input
              aria-label={t("portfolios.search")}
              className="pl-9"
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={t("portfolios.search")}
              type="search"
              value={query}
            />
          </div>
          <p className="text-sm text-(--color-text-secondary)">
            {t("portfolios.count", { count: visible.length })}
          </p>
        </div>
        <PortfoliosTable activeId={active?.id} portfolios={visible} />
        {visible.length > 0 ? (
          <p className="text-sm text-(--color-text-secondary)">
            {t("portfolios.showing", { shown: visible.length, total: portfolios.length })}
          </p>
        ) : null}
      </section>
    </div>
  );
}
