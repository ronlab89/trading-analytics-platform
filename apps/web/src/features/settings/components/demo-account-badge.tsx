import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/badge";

/** The Figma "Cuenta demo" badge. */
export function DemoAccountBadge() {
  const { t } = useTranslation();

  return (
    <Badge tone="info">
      <Info aria-hidden="true" className="size-3" />
      {t("settings.demo.badge")}
    </Badge>
  );
}
