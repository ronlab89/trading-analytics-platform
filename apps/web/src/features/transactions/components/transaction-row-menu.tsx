import { Ellipsis, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TransactionRow } from "../types";

interface TransactionRowMenuProps {
  transaction: TransactionRow;
  onView: (transaction: TransactionRow) => void;
}

/**
 * The "⋯" menu at the end of a transaction row, as the Figma draws it: "Ver detalle" and
 * "Eliminar". "Eliminar" is not offered until the API can delete.
 */
export function TransactionRowMenu({ transaction, onView }: TransactionRowMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={t("transactions.rowMenu.label", {
            name: transaction.name ?? t("transactions.unknownAsset"),
          })}
          size="icon-md"
          variant="ghost"
        >
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-53.5">
        <DropdownMenuItem
          onSelect={() => {
            onView(transaction);
          }}
        >
          <Eye aria-hidden="true" />
          {t("transactions.rowMenu.view")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
