import { useTranslation } from "react-i18next";
import { ProfileFields } from "./profile-fields";
import { SettingsCard } from "./settings-card";

interface ProfileSectionProps {
  name: string;
  email: string;
  role: "VIEWER" | "TRADER" | "ADMIN";
}

/**
 * The account as it is: name, email and role. The Figma card has the name and the email as fields
 * with a save button, but the API has no way to change them, so they are shown, not edited.
 */
export function ProfileSection({ name, email, role }: ProfileSectionProps) {
  const { t } = useTranslation();
  const fields = [
    { label: t("settings.profile.name"), value: name },
    { label: t("settings.profile.email"), value: email },
    { label: t("settings.profile.role"), value: t(`settings.profile.roles.${role}`) },
  ];

  return (
    <SettingsCard
      description={t("settings.sections.profile.description")}
      title={t("settings.sections.profile.title")}
    >
      <ProfileFields fields={fields} />
    </SettingsCard>
  );
}
