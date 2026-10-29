import { useTranslation } from "react-i18next";
import { PortfoliosTable } from "@/features/portfolios/components/portfolios-table";
import { useActivePortfolio } from "@/hooks/use-active-portfolio";
import { usePortfolios } from "@/hooks/use-portfolios";

/**
 * The portfolio list. Loading, empty and failed states arrive in the next tasks, so until then
 * nothing is drawn while the list is not there.
 */
export function PortfoliosPage() {
  const { t } = useTranslation();
  const { data: portfolios } = usePortfolios();
  const { active } = useActivePortfolio();

  if (portfolios === undefined) return null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="sr-only">{t("nav.portfolios")}</h1>
      <p className="text-sm text-(--color-text-secondary)">
        {t("portfolios.summary", { count: portfolios.length })}
      </p>
      <section className="rounded-xl bg-(--color-surface-card) p-6">
        <PortfoliosTable activeId={active?.id} portfolios={portfolios} />
      </section>
    </div>
  );
}
