import { Check, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import { portfolioInitials } from "@/lib/portfolio-initials";

export interface PortfolioRow {
  id: string;
  name: string;
  baseCurrency: string;
  status: "ACTIVE" | "ARCHIVED";
}

interface PortfoliosTableProps {
  portfolios: readonly PortfolioRow[];
  /** The portfolio the app is working on; its row carries the "In use" tag. */
  activeId: string | undefined;
}

const headerCell = "px-3 py-3 text-left text-xs font-semibold text-(--color-text-secondary)";
const cell = "px-3 text-sm";

/**
 * The Figma "Lista · Con datos" table, limited to what the portfolio list returns: value, daily
 * return and positions need analytics data and arrive with FE2.
 */
export function PortfoliosTable({ portfolios, activeId }: PortfoliosTableProps) {
  const { t } = useTranslation();

  return (
    <table aria-label={t("portfolios.table")} className="w-full border-collapse">
      <thead>
        <tr className="border-b border-(--color-border-default)">
          <th className={headerCell} scope="col">
            {t("portfolios.columns.name")}
          </th>
          <th className={headerCell} scope="col">
            {t("portfolios.columns.baseCurrency")}
          </th>
          <th className={headerCell} scope="col">
            {t("portfolios.columns.status")}
          </th>
        </tr>
      </thead>
      <tbody>
        {portfolios.map(({ id, name, baseCurrency, status }) => {
          const inUse = id === activeId;
          return (
            <tr className="h-12 border-b border-(--color-border-default)" key={id}>
              <th className={`${cell} font-normal`} scope="row">
                <span className="flex items-center gap-3">
                  <Avatar
                    initials={portfolioInitials(name)}
                    shape="square"
                    tone={inUse ? "dark" : "neutral"}
                  />
                  <span className="text-left">{name}</span>
                  {inUse ? <Badge>{t("portfolios.inUse")}</Badge> : null}
                </span>
              </th>
              <td className={`${cell} font-medium`}>{baseCurrency}</td>
              <td className={cell}>
                <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>
                  {status === "ACTIVE" ? (
                    <Check aria-hidden="true" className="size-3.5" />
                  ) : (
                    <Tag aria-hidden="true" className="size-3.5" />
                  )}
                  {t(`portfolios.status.${status}`)}
                </Badge>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
