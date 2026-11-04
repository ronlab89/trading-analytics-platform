import { useTranslation } from "react-i18next";
import { SettingsIdentity } from "@/features/settings/components/settings-identity";
import { SettingsNav } from "@/features/settings/components/settings-nav";
import { useSettingsSection } from "@/features/settings/hooks/use-settings-section";
import { useCurrentUser } from "@/hooks/use-session";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Settings: the account in sections, one card in view at a time (Figma "Configuración"). The
 * sections are a menu on the desktop and tabs below it. The section is in the address.
 */
export function SettingsPage() {
  const { t } = useTranslation();
  const [section, selectSection] = useSettingsSection();
  const narrow = useMediaQuery("(max-width: 900px)");
  const user = useCurrentUser();

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl leading-8 font-semibold text-(--color-text-default) desktop:text-3xl desktop:leading-9">
          {t("nav.settings")}
        </h1>
        <p className="text-sm text-(--color-text-secondary)">{t("settings.subtitle")}</p>
      </header>
      <div className="flex flex-col gap-4 desktop:grid desktop:grid-cols-[15rem_minmax(0,45rem)] desktop:gap-4">
        <SettingsNav onSelect={selectSection} section={section} tabs={narrow} />
        <div className="flex min-w-0 flex-col gap-4">
          <SettingsIdentity email={user?.email ?? ""} name={user?.displayName ?? ""} />
          <section
            aria-labelledby="settings-section-title"
            className="flex flex-col gap-4 rounded-xl bg-(--color-surface-card) p-6"
          >
            <h3
              className="text-xl leading-7 font-medium text-(--color-text-default)"
              id="settings-section-title"
            >
              {t(`settings.sections.${section}.title`)}
            </h3>
          </section>
        </div>
      </div>
    </div>
  );
}
