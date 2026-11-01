import type { AssetResponse } from "@trading/contracts";
import { ChevronsUpDown, Search } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useId, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useFieldControlProps } from "@/components/ui/field-context";
import { inputVariants } from "@/components/ui/input";
import { useAssetSearch } from "@/hooks/use-asset-search";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

const SEARCH_DELAY = 250;

const label = ({ symbol, name }: Pick<AssetResponse, "symbol" | "name">) => `${symbol} · ${name}`;

interface AssetComboboxProps {
  /** The asset chosen, or null while none is. The form keeps it, because it also needs its currency. */
  value: AssetResponse | null;
  onChange: (asset: AssetResponse) => void;
}

/**
 * The Figma "Activo" picker: a box that opens a list with its own search. The search asks the API
 * once the person pauses typing, and the list moves with the arrow keys, as a listbox does. It
 * takes its id, description and invalid state from the `Field` around it, like the Select.
 */
export function AssetCombobox({ value, onChange }: AssetComboboxProps) {
  const { t } = useTranslation();
  const field = useFieldControlProps({});
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(0);
  const search = useAssetSearch(useDebouncedValue(term, SEARCH_DELAY), { enabled: open });
  const assets = search.data ?? [];
  const optionId = (index: number) => `${listId}-${String(index)}`;

  const choose = (asset: AssetResponse) => {
    onChange(asset);
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => Math.min(Math.max(current + step, 0), assets.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const asset = assets[active];
      if (asset) choose(asset);
    }
  };

  return (
    <PopoverPrimitive.Root
      onOpenChange={(next) => {
        setOpen(next);
        setTerm("");
        setActive(0);
      }}
      open={open}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          aria-controls={open ? listId : undefined}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            inputVariants(),
            "group flex items-center justify-between gap-2 text-left",
            value === null && "text-(--color-text-secondary)",
          )}
          role="combobox"
          type="button"
          {...field}
        >
          <span className="truncate">{value ? label(value) : t("assetCombobox.placeholder")}</span>
          <ChevronsUpDown
            aria-hidden="true"
            className="size-4 shrink-0 text-(--color-text-secondary)"
          />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          className="z-50 w-(--radix-popover-trigger-width) overflow-hidden rounded-md border border-(--color-border-default) bg-(--color-surface-card) text-(--color-text-default)"
          sideOffset={4}
        >
          <div className="flex items-center gap-2 border-b border-(--color-border-default) px-3">
            <Search aria-hidden="true" className="size-4 shrink-0 text-(--color-text-secondary)" />
            <input
              aria-activedescendant={assets[active] ? optionId(active) : undefined}
              aria-controls={listId}
              aria-label={t("assetCombobox.search")}
              autoComplete="off"
              className="h-10 w-full bg-transparent text-sm outline-0 placeholder:text-(--color-text-secondary)"
              onChange={(event) => {
                setTerm(event.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={t("assetCombobox.searchPlaceholder")}
              value={term}
            />
          </div>
          <ul
            aria-label={t("assetCombobox.list")}
            className="max-h-60 overflow-y-auto p-1"
            id={listId}
            role="listbox"
          >
            {assets.map((asset, index) => (
              <li
                aria-selected={asset.id === value?.id}
                className={cn(
                  "flex h-8 cursor-default items-center rounded-sm px-2 text-sm select-none",
                  index === active && "bg-(--color-menu-item-background-hover)",
                  asset.id === value?.id && "font-medium",
                )}
                id={optionId(index)}
                key={asset.id}
                onClick={() => {
                  choose(asset);
                }}
                onMouseMove={() => {
                  setActive(index);
                }}
                role="option"
              >
                {label(asset)}
              </li>
            ))}
          </ul>
          {search.isError && assets.length === 0 ? (
            <p className="px-3 py-2 text-sm text-(--color-text-secondary)" role="alert">
              {t("assetCombobox.failed")}
            </p>
          ) : search.isPending ? (
            <p className="px-3 py-2 text-sm text-(--color-text-secondary)" role="status">
              {t("assetCombobox.searching")}
            </p>
          ) : assets.length === 0 ? (
            <p className="px-3 py-2 text-sm text-(--color-text-secondary)" role="status">
              {t("assetCombobox.empty")}
            </p>
          ) : null}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
