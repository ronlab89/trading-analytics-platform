import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface PortfoliosToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** How many portfolios the list shows; `undefined` while it loads. */
  count: number | undefined;
}

/** The search and the count above the table. While the list loads, the search waits disabled. */
export function PortfoliosToolbar({ query, onQueryChange, count }: PortfoliosToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="relative w-70 max-w-full">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-text-secondary)"
        />
        <Input
          aria-label={t("portfolios.search")}
          className="pl-9"
          disabled={count === undefined}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          placeholder={t("portfolios.search")}
          type="search"
          value={query}
        />
      </div>
      {count === undefined ? (
        <Skeleton className="h-4 w-18" />
      ) : (
        <p className="text-sm text-(--color-text-secondary)">{t("portfolios.count", { count })}</p>
      )}
    </div>
  );
}
