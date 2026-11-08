import type { ReactNode } from "react";

/** Labelled values, to read: the same list in the Profile card of Settings and in the profile view. */
export function ProfileFields({
  fields,
}: {
  fields: readonly { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="flex flex-col gap-4">
      {fields.map(({ label, value }) => (
        <div className="flex flex-col gap-1" key={label}>
          <dt className="text-sm font-medium text-(--color-text-default)">{label}</dt>
          <dd className="text-base text-(--color-text-default)">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
