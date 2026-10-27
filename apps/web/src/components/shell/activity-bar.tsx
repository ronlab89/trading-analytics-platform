import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { Logo } from "@/components/logo";
import { Separator } from "@/components/ui/separator";
import { activeDestinationPath, DESTINATIONS, SETTINGS_DESTINATION } from "./destinations";
import { NavItem } from "./nav-item";
import { UserMenu } from "./user-menu";

interface ActivityBarProps {
  userName: string;
  userInitials: string;
  onViewProfile: () => void;
  onSignOut: () => void;
}

/** The fixed 56 px icon rail on the left (tablet and desktop; mobile uses the bottom tab bar). */
export function ActivityBar({
  userName,
  userInitials,
  onViewProfile,
  onSignOut,
}: ActivityBarProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const activePath = activeDestinationPath(pathname);

  return (
    <nav
      aria-label={t("shell.mainNavigation")}
      className="hidden w-14 shrink-0 flex-col items-center justify-between rounded-md bg-card px-2 pt-3 pb-2 md:flex"
    >
      <div className="flex flex-col items-center gap-3">
        <Logo />
        <Separator className="w-[30px]" />
        <div className="flex flex-col items-center gap-1">
          {DESTINATIONS.map(({ path, labelKey, icon }) => (
            <NavItem
              active={path === activePath}
              icon={icon}
              key={path}
              label={t(labelKey)}
              to={path}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1">
        <NavItem
          active={SETTINGS_DESTINATION.path === activePath}
          icon={SETTINGS_DESTINATION.icon}
          label={t(SETTINGS_DESTINATION.labelKey)}
          to={SETTINGS_DESTINATION.path}
        />
        <UserMenu
          name={userName}
          initials={userInitials}
          onSignOut={onSignOut}
          onViewProfile={onViewProfile}
        />
      </div>
    </nav>
  );
}
