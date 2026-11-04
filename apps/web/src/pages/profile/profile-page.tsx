import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { userInitials } from "@/features/auth/lib/user-initials";
import { DemoAccountBadge } from "@/features/settings/components/demo-account-badge";
import { ProfileFields } from "@/features/settings/components/profile-fields";
import { SettingsCard } from "@/features/settings/components/settings-card";
import { useCurrentUser } from "@/hooks/use-session";

/**
 * The read-only profile the avatar opens (Figma "Perfil · Solo lectura"): who the user is and the
 * way to Settings, where anything can be changed. "Miembro desde" and "Moneda base" of the frame are
 * left out because the API does not return them; the role takes their place.
 */
export function ProfilePage() {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const name = user?.displayName ?? "";

  return (
    <div className="flex flex-col gap-4 desktop:gap-6">
      <h1 className="sr-only">{t("nav.profile")}</h1>
      <div className="max-w-180">
        <SettingsCard
          heading="h2"
          description={t("settings.profileView.description")}
          title={t("nav.profile")}
        >
          <div className="flex items-center gap-4">
            <Avatar initials={userInitials(name)} size="lg" tone="brand" />
            <div className="flex min-w-0 flex-col items-start gap-1">
              <p className="truncate text-base text-(--color-text-default)">{name}</p>
              {env.VITE_APP_MODE === "demo" ? <DemoAccountBadge /> : null}
            </div>
          </div>
          <ProfileFields
            fields={[
              { label: t("settings.profile.email"), value: user?.email ?? "" },
              {
                label: t("settings.profile.role"),
                value: t(`settings.profile.roles.${user?.role ?? "VIEWER"}`),
              },
            ]}
          />
          <div>
            <Button asChild variant="outline">
              <Link to="/settings">{t("settings.profileView.goToSettings")}</Link>
            </Button>
          </div>
        </SettingsCard>
      </div>
    </div>
  );
}
