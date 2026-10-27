import { Check, Ellipsis } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "cn";
import {
  activeDestinationPath,
  MORE_DESTINATIONS,
  TAB_DESTINATIONS,
  type Destination,
} from "./destinations";

const tabClasses =
  "group flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-xs outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

function Pill({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "flex h-8 w-12 items-center justify-center rounded-full",
        active
          ? "bg-(--color-nav-item-background-active) text-(--color-nav-item-foreground-active)"
          : "text-(--color-nav-item-foreground) group-hover:bg-(--color-nav-item-background-hover) group-hover:text-(--color-nav-item-foreground-hover)",
      )}
    >
      {children}
    </span>
  );
}

function tabLabelClasses(active: boolean) {
  return active ? "font-medium text-foreground" : "text-muted-foreground";
}

function MoreItem({
  destination,
  active,
  onNavigate,
}: {
  destination: Destination;
  active: boolean;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const Icon = destination.icon;

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-12 items-center gap-2 rounded-sm px-3 text-base outline-hidden focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        active
          ? "bg-(--color-surface-selected) font-medium"
          : "hover:bg-(--color-menu-item-background-hover)",
      )}
      onClick={onNavigate}
      to={destination.path}
    >
      <Icon aria-hidden="true" className="size-5" />
      <span className="flex-1">{t(destination.labelKey)}</span>
      {active ? <Check aria-hidden="true" className="size-5" /> : null}
    </Link>
  );
}

/**
 * The mobile navigation: four tabs plus "More", which opens a sheet with the other views.
 * Tablet and desktop use the activity bar instead.
 */
export function BottomTabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const activePath = activeDestinationPath(pathname);
  const moreActive = MORE_DESTINATIONS.some(({ path }) => path === activePath);

  return (
    <nav
      aria-label={t("shell.tabNavigation")}
      className="flex shrink-0 border-t bg-card pb-3 tablet:hidden"
    >
      {TAB_DESTINATIONS.map(({ path, labelKey, icon: Icon }) => {
        const active = path === activePath;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={tabClasses}
            key={path}
            to={path}
          >
            <Pill active={active}>
              <Icon aria-hidden="true" className="size-6" />
            </Pill>
            <span className={tabLabelClasses(active)}>{t(labelKey)}</span>
          </Link>
        );
      })}
      <Sheet onOpenChange={setMoreOpen} open={moreOpen}>
        <SheetTrigger className={tabClasses}>
          <Pill active={moreActive}>
            <Ellipsis aria-hidden="true" className="size-6" />
          </Pill>
          <span className={tabLabelClasses(moreActive)}>{t("shell.more")}</span>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="px-3 pb-2 text-sm font-medium text-muted-foreground">
            {t("shell.more")}
          </SheetTitle>
          {MORE_DESTINATIONS.map((destination) => (
            <MoreItem
              active={destination.path === activePath}
              destination={destination}
              key={destination.path}
              onNavigate={() => {
                setMoreOpen(false);
              }}
            />
          ))}
        </SheetContent>
      </Sheet>
    </nav>
  );
}
