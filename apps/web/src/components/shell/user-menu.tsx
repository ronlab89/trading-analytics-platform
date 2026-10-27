import { LogOut, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  name: string;
  initials: string;
  onViewProfile: () => void;
  onSignOut: () => void;
}

/** The avatar of the activity bar and the menu it opens. */
export function UserMenu({ name, initials, onViewProfile, onSignOut }: UserMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("shell.userMenu")}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          type="button"
        >
          <Avatar initials={initials} shape="circle" size="md" tone="dark" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60" side="right">
        <DropdownMenuLabel>{name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={onViewProfile}>
          <User />
          {t("shell.viewProfile")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut} variant="destructive">
          <LogOut />
          {t("shell.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
