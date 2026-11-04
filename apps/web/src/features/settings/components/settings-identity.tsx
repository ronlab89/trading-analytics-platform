import { Avatar } from "@/components/avatar";
import { userInitials } from "@/features/auth/lib/user-initials";

/** Who is signed in: the avatar with the name and the email, above the section in view. */
export function SettingsIdentity({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar initials={userInitials(name)} size="lg" tone="dark" />
      <div className="flex min-w-0 flex-col">
        <h2 className="truncate text-xl leading-7 font-semibold text-(--color-text-default)">
          {name}
        </h2>
        <p className="truncate text-sm text-(--color-text-secondary)">{email}</p>
      </div>
    </div>
  );
}
