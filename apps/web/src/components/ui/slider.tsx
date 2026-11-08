import { Slider as SliderPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SliderProps = Omit<
  ComponentProps<typeof SliderPrimitive.Root>,
  "value" | "defaultValue" | "onValueChange" | "min" | "max" | "step"
> & {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  /** Values that get a dot on the track, such as the stops the labels under it name. */
  marks?: readonly number[] | undefined;
  "aria-label": string;
};

/**
 * The Figma "Slider": a 4 px track filled from the start up to a 16 px thumb, with an optional dot on
 * each mark. It holds one value, so it takes and gives a number instead of Radix's array. Radix keeps
 * the keyboard (arrows, Home, End, Page keys), the pointer and the `slider` semantics, which the
 * thumb carries, so the name goes on the thumb.
 */
function Slider({
  className,
  value,
  onValueChange,
  min,
  max,
  step,
  marks,
  "aria-label": ariaLabel,
  ...props
}: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex h-6 w-full touch-none items-center select-none data-disabled:opacity-50",
        className,
      )}
      data-slot="slider"
      max={max}
      min={min}
      onValueChange={([next]) => {
        if (next !== undefined) onValueChange(next);
      }}
      step={step}
      value={[value]}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-(--color-border-input)">
        <SliderPrimitive.Range className="absolute h-full bg-(--color-text-default)" />
      </SliderPrimitive.Track>
      {marks?.map((mark) => (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-(--color-text-secondary) bg-(--color-surface-card)"
          data-slot="slider-mark"
          key={mark}
          style={{ left: `${String(((mark - min) / (max - min)) * 100)}%` }}
        />
      ))}
      <SliderPrimitive.Thumb
        aria-label={ariaLabel}
        className="block size-4 rounded-full border-2 border-(--color-text-default) bg-(--color-surface-card) transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-border-ring) disabled:pointer-events-none"
        data-slot="slider-thumb"
      />
    </SliderPrimitive.Root>
  );
}

export { Slider };
