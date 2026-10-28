import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import { Badge } from "@/components/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PortfolioOption {
  id: string;
  name: string;
  currency: string;
  initials: string;
}

interface PortfolioSelectorProps {
  portfolios: readonly PortfolioOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** The active portfolio of the top bar; choosing another one re-renders every view (FE1 wires it). */
export function PortfolioSelector({ portfolios, selectedId, onSelect }: PortfolioSelectorProps) {
  const { t } = useTranslation();
  const selected = portfolios.find((portfolio) => portfolio.id === selectedId);

  if (!selected) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("shell.selectPortfolio")}
          className="flex items-center tablet:w-50 gap-2 rounded-md border border-input py-1 pr-2 pl-1 text-left hover:bg-(--color-surface-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring aria-expanded:border-(--color-border-strong-hover) aria-expanded:bg-(--color-surface-hover)"
          type="button"
        >
          <Avatar initials={selected.initials} shape="square" size="sm" tone="brand" />
          <span className="flex-1 truncate text-sm font-medium">{selected.name}</span>
          <Badge className="max-tablet:hidden">{selected.currency}</Badge>
          <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-65">
        <DropdownMenuLabel>{t("shell.portfolios")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup onValueChange={onSelect} value={selectedId}>
          {portfolios.map((portfolio) => (
            <DropdownMenuRadioItem key={portfolio.id} value={portfolio.id}>
              {portfolio.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
