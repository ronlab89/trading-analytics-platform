import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { DemoAccountBadge } from "./demo-account-badge";
import { SettingsCard } from "./settings-card";

/** Demo mode is only informative, as in the Figma: it has no control that does not exist in the product. */
export function DemoSection() {
  const { t } = useTranslation();

  return (
    <SettingsCard
      description={t("settings.sections.demo.description")}
      title={t("settings.sections.demo.title")}
    >
      <div>
        <DemoAccountBadge />
      </div>
      <Alert
        description={t("settings.demo.description")}
        title={t("settings.demo.title")}
        tone="info"
      />
    </SettingsCard>
  );
}
