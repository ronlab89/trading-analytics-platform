import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";

interface CatalogSearchProps {
  value: string;
  onChange: (value: string) => void;
  /** Waits disabled, while the first page is still loading. */
  disabled?: boolean;
}

/** The "Buscar por símbolo o nombre" box of the catalog, as the Figma draws it. The text is the view's. */
export function CatalogSearch({ value, onChange, disabled = false }: CatalogSearchProps) {
  const { t } = useTranslation();

  return (
    <div className="relative w-70 max-w-full max-tablet:w-full">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--color-text-secondary)"
      />
      <Input
        aria-label={t("markets.catalogSearch")}
        className="pl-9"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder={t("markets.catalogSearch")}
        type="search"
        value={value}
      />
    </div>
  );
}
