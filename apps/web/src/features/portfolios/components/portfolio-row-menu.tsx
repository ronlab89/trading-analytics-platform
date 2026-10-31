import { Archive, CircleCheck, Ellipsis, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { PortfolioRow } from "../types";

interface PortfolioRowMenuProps {
  portfolio: PortfolioRow;
  /** This is the portfolio the app works on, so "Usar este portafolio" shows as already chosen. */
  inUse: boolean;
  onUse: (portfolioId: string) => void;
  onEdit: (portfolioId: string) => void;
  onArchive: (portfolioId: string) => void;
}

/**
 * The "⋯" menu at the end of a portfolio row, as the Figma draws it: "Usar este portafolio" (with a
 * check on the one in use), "Editar" and "Archivar". "Eliminar" is not offered until the API can
 * delete. An archived portfolio has no menu: the API refuses to change it and the app does not
 * work on it, so nothing in it would apply.
 */
export function PortfolioRowMenu({
  portfolio,
  inUse,
  onUse,
  onEdit,
  onArchive,
}: PortfolioRowMenuProps) {
  const { t } = useTranslation();

  if (portfolio.status === "ARCHIVED") {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("portfolios.rowMenu.label", { name: portfolio.name })}
          size="icon-md"
          variant="ghost"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-53.5">
        <DropdownMenuCheckboxItem
          checked={inUse}
          className="pr-2 pl-2 focus:bg-(--color-menu-item-background-hover) focus:text-foreground data-[state=checked]:bg-(--color-surface-selected) [&>span]:right-2"
          onSelect={() => {
            onUse(portfolio.id);
          }}
        >
          <CircleCheck aria-hidden="true" />
          {t("portfolios.rowMenu.use")}
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem
          onSelect={() => {
            onEdit(portfolio.id);
          }}
        >
          <Pencil aria-hidden="true" />
          {t("portfolios.rowMenu.edit")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            onArchive(portfolio.id);
          }}
        >
          <Archive aria-hidden="true" />
          {t("portfolios.rowMenu.archive")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
