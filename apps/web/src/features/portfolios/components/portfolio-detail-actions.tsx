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
  /** Mobile adds the "⋯" menu, which the tablet and desktop headers do not draw. */
  menu: boolean;
  onEdit: () => void;
  onArchive: () => void;
}

/**
 * The actions at the right of the detail header, as the Figma draws them: an "Editar" button and,
 * on mobile, a "⋯" menu with "Editar" and "Archivar". "Eliminar" is not offered until the API can
 * delete.
 */
export function PortfolioDetailActions({ menu, onEdit, onArchive }: PortfolioDetailActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Button onClick={onEdit} size="sm" variant="outline">
        <Pencil aria-hidden="true" />
        {t("portfolios.rowMenu.edit")}
      </Button>
      {menu ? <DetailMenu onArchive={onArchive} onEdit={onEdit} /> : null}
    </div>
  );
}

function DetailMenu({
  onEdit,
  onArchive,
}: Pick<PortfolioDetailActionsProps, "onEdit" | "onArchive">) {
  const { t } = useTranslation();

  return (
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
  );
}
