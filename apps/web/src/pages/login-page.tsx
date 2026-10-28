import { useTranslation } from "react-i18next";
import { Navigate, useLocation } from "react-router";
import { Alert } from "@/components/ui/alert";
import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";
import { LoginForm } from "@/features/auth/components/login-form";
import { resolveRedirectPath } from "@/features/auth/lib/resolve-redirect-path";
import { useSessionExpired, useSessionStatus } from "@/hooks/use-session";

/**
 * The sign in, outside the shell. Three layouts from the Figma "Acceso" frames: brand panel
 * and form side by side on desktop, stacked with a panel on tablet, and a strip on mobile.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const status = useSessionStatus();
  const expired = useSessionExpired();

  if (status === "authenticated") {
    return <Navigate replace to={resolveRedirectPath(location.state)} />;
  }

  // Like the private routes, wait for the restore instead of flashing a form the user will skip.
  if (status === "unknown") {
    return (
      <div className="p-6 text-sm text-(--color-text-secondary)" role="status">
        {t("auth.restoringSession")}
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-(--color-surface-page) tablet:gap-4 tablet:p-4 desktop:flex-row">
      <LoginBrandPanel />
      <main className="flex flex-1 flex-col bg-(--color-surface-card) px-6 pt-8 pb-6 tablet:items-center tablet:justify-center tablet:rounded-xl tablet:px-12 tablet:py-0 desktop:w-140 desktop:flex-none">
        <div className="flex w-full flex-col gap-6 tablet:max-w-95">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl leading-9 font-semibold tracking-[-1px] text-(--color-text-default)">
              {t("auth.login.title")}
            </h1>
            <p className="text-sm leading-5 text-(--color-text-secondary)">
              {t("auth.login.subtitle")}
            </p>
          </div>
          {expired ? (
            <Alert
              description={t("auth.login.expired.description")}
              title={t("auth.login.expired.title")}
              tone="warning"
            />
          ) : null}
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
