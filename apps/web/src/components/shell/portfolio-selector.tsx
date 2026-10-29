import { ChevronDown, CircleAlert, RotateCw } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PortfolioOption {
  id: string;
  name: string;
  currency: string;
  initials: string;
}

interface PortfolioSelectorProps {
  portfolios: readonly PortfolioOption[];
  selectedId: string | undefined;
  /** The Figma "Loading" state: the skeleton stands in until the list arrives. */
  loading?: boolean;
  /** The list failed to load; the selector offers `onRetry`. */
  failed?: boolean;
  onRetry?: () => void;
  onSelect: (id: string) => void;
}

/** Same box as every Figma variant; the empty and failed states borrow the "Disabled" colors. */
const UNAVAILABLE_CLASSES =
  "flex items-center tablet:w-50 gap-2 rounded-md border border-input py-1 pr-2 pl-1 text-left text-(--color-text-disabled) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/**
 * The active portfolio of the top bar; choosing another one re-renders every view. Figma draws
 * no empty or failed state, so those two reuse the "Disabled" variant's box and colors: a muted
 * "No portfolios", and a retry button when the load failed.
 */
export function PortfolioSelector({
  portfolios,
  selectedId,
  loading = false,
  failed = false,
  onRetry,
  onSelect,
}: PortfolioSelectorProps) {
  const { t } = useTranslation();
  const selected = portfolios.find((portfolio) => portfolio.id === selectedId);

  if (loading) {
    return (
      <div
        aria-label={t("shell.loadingPortfolios")}
        className="flex items-center gap-2 rounded-md border border-input py-1 pr-2 pl-1 tablet:w-50"
        role="status"
      >
        <Skeleton className="size-6" />
        <Skeleton className="h-3 w-22" />
        <Skeleton className="h-3 w-8" />
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </div>
    );
  }

  if (failed) {
    return (
      <button
        aria-label={t("shell.retryPortfolios")}
        className={cn(UNAVAILABLE_CLASSES, "hover:bg-(--color-surface-hover)")}
        onClick={onRetry}
        type="button"
      >
        <CircleAlert aria-hidden="true" className="size-6 p-1 text-destructive" />
        <span className="flex-1 truncate text-sm font-medium">{t("shell.portfoliosFailed")}</span>
        <RotateCw aria-hidden="true" className="size-4 text-muted-foreground" />
      </button>
    );
  }

  if (!selected) {
    return (
      <button
        aria-label={t("shell.noPortfolios")}
        className={cn(UNAVAILABLE_CLASSES, "cursor-not-allowed")}
        disabled
        type="button"
      >
        <span aria-hidden="true" className="size-6" />
        <span className="flex-1 truncate text-sm font-medium">{t("shell.noPortfolios")}</span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
    );
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
