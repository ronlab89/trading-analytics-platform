import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useFieldControlProps } from "./field-context";
import { inputControlClasses } from "./input";

/**
 * The Figma "Textarea": the Input's states over a box that is 80 px tall at least, with 8 px of
 * padding above and below, 14/20 text and the grip to resize it vertically. A form that draws it
 * shorter, as the portfolio dialog does, says so with `min-h-*` and `rows`.
 */
function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  const control = useFieldControlProps(props);

  return (
    <textarea
      className={cn(
        inputControlClasses,
        "min-h-20 resize-y px-3 py-2 text-sm leading-5",
        className,
      )}
      data-slot="textarea"
      {...props}
      {...control}
    />
  );
}

export { Textarea };
