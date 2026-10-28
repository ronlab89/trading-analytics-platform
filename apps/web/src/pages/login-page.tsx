import { useTranslation } from "react-i18next";
import { LoginBrandPanel } from "@/features/auth/components/login-brand-panel";
import { LoginForm } from "@/features/auth/components/login-form";

/**
 * The sign in, outside the shell. Three layouts from the Figma "Acceso" frames: brand panel
 * and form side by side on desktop, stacked with a panel on tablet, and a strip on mobile.
 */
export function LoginPage() {
  const { t } = useTranslation();

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
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
