import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  initials: string;
  onViewProfile: () => void;
  onSignOut: () => void;
}

/** The avatar of the activity bar and the menu it opens. */
export function UserMenu({ initials, onViewProfile, onSignOut }: UserMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={t("shell.userMenu")}
          className="flex size-8 items-center justify-center rounded-full bg-(--color-avatar-dark-background) text-xs font-semibold text-(--color-avatar-dark-foreground) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          type="button"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right">
        <DropdownMenuItem onSelect={onViewProfile}>{t("shell.viewProfile")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={onSignOut}>{t("shell.signOut")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
