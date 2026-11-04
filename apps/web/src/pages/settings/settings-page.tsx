import { useState } from "react";
import { useTranslation } from "react-i18next";
import { env } from "@/config/env";
import { DemoSection } from "@/features/settings/components/demo-section";
import { LeaveSettingsDialog } from "@/features/settings/components/leave-settings-dialog";
import { PreferencesSection } from "@/features/settings/components/preferences-section";
import { ProfileSection } from "@/features/settings/components/profile-section";
import { SettingsIdentity } from "@/features/settings/components/settings-identity";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { useSettingsSection } from "@/features/settings/hooks/use-settings-section";
import { useUnsavedChangesGuard } from "@/features/settings/hooks/use-unsaved-changes-guard";
import { sectionsFor } from "@/features/settings/lib/settings-sections";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useCurrentUser } from "@/hooks/use-session";

/**
 * Settings: the account in sections, one card in view at a time (Figma "Configuración"). The
 * sections are a menu on the desktop and tabs below it. The section is in the address.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const demo = env.VITE_APP_MODE === "demo";
  const sections = sectionsFor(env.VITE_APP_MODE);
  const [section, selectSection] = useSettingsSection(sections);
  const narrow = useMediaQuery("(max-width: 900px)");
  const user = useCurrentUser();
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedChangesGuard(dirty);

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl leading-8 font-semibold text-(--color-text-default) desktop:text-3xl desktop:leading-9">
          {t("nav.settings")}
        </h1>
        <p className="text-sm text-(--color-text-secondary)">{t("settings.subtitle")}</p>
      </header>
      <div className="flex flex-col gap-4 desktop:grid desktop:grid-cols-[15rem_minmax(0,45rem)] desktop:gap-4">
        <SettingsNav
          onSelect={(next) => {
            if (next !== section)
              guard.guard(() => {
                selectSection(next);
              });
          }}
          section={section}
          sections={sections}
          tabs={narrow}
        />
        <div className="flex min-w-0 flex-col gap-4">
          <SettingsIdentity demo={demo} email={user?.email ?? ""} name={user?.displayName ?? ""} />
          {section === "profile" ? (
            <ProfileSection
              email={user?.email ?? ""}
              name={user?.displayName ?? ""}
              role={user?.role ?? "VIEWER"}
            />
          ) : section === "demo" ? (
            <DemoSection />
          ) : (
            <PreferencesSection onDirtyChange={setDirty} />
          )}
        </div>
      </div>
      <LeaveSettingsDialog onKeepEditing={guard.stay} onLeave={guard.leave} open={guard.asking} />
    </div>
  );
}
