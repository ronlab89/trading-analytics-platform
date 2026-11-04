import { useId, type ReactNode } from "react";

interface SettingsCardProps {
  title: string;
  description: string;
  children?: ReactNode;
  /** Under the page title the card is a second-level heading; below the identity of Settings, a third. */
  heading?: "h2" | "h3";
}

/** The card of one section: its title and a line saying what it is for, then the content. */
export function SettingsCard({
  title,
  description,
  children,
  heading: Heading = "h3",
}: SettingsCardProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6"
    >
      <div className="flex flex-col gap-1">
        <Heading className="text-xl leading-7 font-medium text-(--color-text-default)" id={titleId}>
          {title}
        </Heading>
        <p className="text-xs text-(--color-text-secondary)">{description}</p>
      </div>
      {children}
    </section>
  );
}
