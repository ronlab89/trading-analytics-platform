import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import { portfolioInitials } from "@/lib/portfolio-initials";
import type { PortfolioRow } from "../types";

interface PortfolioCardListProps {
  portfolios: readonly PortfolioRow[];
  /** The portfolio in use, which gets the dark avatar. */
  activeId: string | undefined;
}

/**
 * The Figma mobile list: a card of rows (initials, name and a line under it) instead of a table.
 * The line under the name is "In use" for the portfolio in use, "Archived" for an archived one and
 * the base currency otherwise, as in the design. Value and daily return, at the right of each
 * row, need analytics data and arrive with FE2, like the positions count that starts that line.
 */
export function PortfolioCardList({ portfolios, activeId }: PortfolioCardListProps) {
  const { t } = useTranslation();

  return (
    <ul
      aria-label={t("portfolios.table")}
      className="flex flex-col overflow-hidden rounded-xl bg-(--color-surface-card)"
    >
      {portfolios.map((portfolio) => {
        const inUse = portfolio.id === activeId;
        const detail = inUse
          ? t("portfolios.inUse")
          : portfolio.status === "ARCHIVED"
            ? t("portfolios.status.ARCHIVED")
            : portfolio.baseCurrency;

        return (
          <li
            className="border-b border-(--color-border-default) last:border-b-0"
            key={portfolio.id}
          >
            <Link
              className="flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              to={`/portfolios/${portfolio.id}`}
            >
              <Avatar
                initials={portfolioInitials(portfolio.name)}
                shape="square"
                size="lg"
                tone={inUse ? "dark" : "neutral"}
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-sm leading-5 font-medium text-(--color-text-default)">
                  {portfolio.name}
                </span>
                <span className="text-xs leading-4 text-(--color-text-secondary)">{detail}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
