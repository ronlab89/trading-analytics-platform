import { Archive, Ellipsis, Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PortfolioDetailActionsProps {
  onEdit: () => void;
  onArchive: () => void;
}

/**
 * The actions at the right of the mobile detail header, as the Figma draws them: an "Editar" button
 * and a "⋯" menu with "Editar" and "Archivar". "Eliminar" is not offered until the API can delete.
 */
export function PortfolioDetailActions({ onEdit, onArchive }: PortfolioDetailActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Button onClick={onEdit} size="sm" variant="outline">
        <Pencil aria-hidden="true" />
        {t("portfolios.rowMenu.edit")}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button aria-label={t("portfolioDetail.menu.label")} size="icon-md" variant="ghost">
            <Ellipsis aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-53.5">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil aria-hidden="true" />
            {t("portfolios.rowMenu.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onArchive}>
            <Archive aria-hidden="true" />
            {t("portfolios.rowMenu.archive")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
