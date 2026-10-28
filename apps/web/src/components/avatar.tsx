import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatar = cva(
  "inline-flex shrink-0 items-center justify-center text-xs font-semibold select-none",
  {
    variants: {
      size: { sm: "size-6", md: "size-8", lg: "size-10" },
      shape: { square: "rounded-md", circle: "rounded-full" },
      tone: {
        neutral: "bg-(--color-avatar-neutral-background) text-(--color-avatar-neutral-foreground)",
        dark: "bg-(--color-avatar-dark-background) text-(--color-avatar-dark-foreground)",
        brand: "bg-(--color-avatar-brand-background) text-(--color-avatar-brand-foreground)",
      },
    },
    defaultVariants: { size: "md", shape: "circle", tone: "neutral" },
  },
);

type AvatarProps = VariantProps<typeof avatar> & { initials: string; className?: string };

/** The Figma "Avatar": initials only. Decorative, because the name it stands for is always nearby. */
export function Avatar({ initials, size, shape, tone, className }: AvatarProps) {
  return (
    <span aria-hidden="true" className={cn(avatar({ size, shape, tone }), className)}>
      {initials}
    </span>
  );
}
