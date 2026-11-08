import { Avatar } from "@/components/avatar";
import { userInitials } from "@/features/auth/lib/user-initials";
import { DemoAccountBadge } from "./demo-account-badge";

interface SettingsIdentityProps {
  name: string;
  email: string;
  /** The demo build says so next to the name, as the Figma does. */
  demo: boolean;
}

/** Who is signed in: the avatar with the name and the email, above the section in view. */
export function SettingsIdentity({ name, email, demo }: SettingsIdentityProps) {
  return (
    <div className="flex items-center gap-4">
      <Avatar initials={userInitials(name)} size="lg" tone="dark" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="truncate text-xl leading-7 font-semibold text-(--color-text-default)">
          {name}
        </h2>
        <p className="truncate text-sm text-(--color-text-secondary)">{email}</p>
      </div>
      {demo ? <DemoAccountBadge /> : null}
    </div>
  );
}
