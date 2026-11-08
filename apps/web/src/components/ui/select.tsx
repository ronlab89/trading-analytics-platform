import type { VariantProps } from "class-variance-authority";
import { Check, ChevronDown } from "lucide-react";
import { Select as SelectPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useFieldControlProps } from "./field-context";
import { inputVariants } from "./input";

const Select = SelectPrimitive.Root;
const SelectValue = SelectPrimitive.Value;

type SelectTriggerProps = ComponentProps<typeof SelectPrimitive.Trigger> &
  VariantProps<typeof inputVariants>;

/**
 * The Figma "Select": the Input's box and states (three sizes) with a chevron that turns up
 * while the list is open. It takes its id, description, required, invalid and disabled from
 * the `Field` around it, as the Input does.
 */
function SelectTrigger({ className, size, children, ...props }: SelectTriggerProps) {
  const { required, ...control } = useFieldControlProps(props);

  return (
    <SelectPrimitive.Trigger
      className={cn(
        inputVariants({ size }),
        "group flex items-center justify-between gap-2 text-left data-placeholder:text-(--color-text-secondary)",
        className,
      )}
      data-slot="select-trigger"
      {...props}
      {...control}
      {...(required ? { "aria-required": true } : {})}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-(--color-text-secondary) transition-transform group-data-[state=open]:rotate-180"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

/** The list under the trigger, as wide as the trigger, with 4 px between them. */
function SelectContent({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          "z-50 max-h-(--radix-select-content-available-height) w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border border-(--color-border-default) bg-(--color-surface-card) p-1 text-(--color-text-default) duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        data-slot="select-content"
        position="popper"
        sideOffset={4}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/** One option: 32 px tall, tinted under the pointer or the keyboard, bold with a check once chosen. */
function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      className={cn(
        "relative flex h-8 w-full cursor-default items-center gap-2 rounded-sm px-2 text-sm outline-hidden select-none data-highlighted:bg-(--color-menu-item-background-hover) data-[state=checked]:bg-(--color-surface-selected) data-[state=checked]:font-medium data-disabled:pointer-events-none data-disabled:text-(--color-text-disabled)",
        className,
      )}
      data-slot="select-item"
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
        <Check aria-hidden="true" className="size-4" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
