import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export function HomePage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("app.title")}</h1>
      <Button>Placeholder</Button>
    </div>
  );
}
