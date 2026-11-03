import { Tabs as TabsPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/** The Figma segmented control: a light track holding the tabs, the current one dark. */
function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-(--color-surface-secondary) p-1",
        className,
      )}
      data-slot="tabs-list"
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-(--color-text-secondary) transition-colors select-none hover:text-(--color-text-default) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-button-focus-ring) data-[state=active]:bg-(--color-button-primary-background) data-[state=active]:text-(--color-button-primary-foreground)",
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("focus-visible:outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
