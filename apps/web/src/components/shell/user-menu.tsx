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
  /** Where the menu opens: beside the activity bar, below the mobile top bar. */
  side?: "right" | "bottom";
}

/** The avatar of the activity bar and the menu it opens. */
export function UserMenu({
  name,
  initials,
  onViewProfile,
  onSignOut,
  side = "right",
}: UserMenuProps) {
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
      <DropdownMenuContent align="end" className="w-60" side={side}>
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
