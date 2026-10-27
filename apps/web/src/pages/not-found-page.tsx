import { useTranslation } from "react-i18next";
import { Link } from "react-router";

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-screen flex-col items-start gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t("notFound.title")}</h1>
      <Link className="underline" to="/">
        {t("notFound.back")}
      </Link>
    </main>
  );
}
