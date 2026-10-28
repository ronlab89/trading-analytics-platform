import { useTranslation } from "react-i18next";
import { Logo } from "@/components/logo";

/**
 * The Figma "Panel de marca": a gradient with the brand and the message. It is a panel on
 * desktop and tablet and a strip on mobile, where the subtitle is left out.
 */
export function LoginBrandPanel() {
  const { t } = useTranslation();

  return (
    <div className="flex h-50 shrink-0 flex-col justify-between bg-[linear-gradient(131deg,var(--color-brand-brand-gradient-from),var(--color-brand-brand))] px-6 pt-10 pb-8 text-(--color-text-on-brand) tablet:h-72 tablet:rounded-xl tablet:p-10 desktop:h-auto desktop:flex-1">
      <div className="flex items-center gap-3">
        <Logo tone="on-brand" />
        <span className="text-sm leading-5 font-medium">{t("auth.login.brand.name")}</span>
      </div>
      <div className="flex flex-col gap-4">
        <p className="font-heading max-w-64 text-2xl leading-8 font-semibold tracking-[-1px] text-balance tablet:max-w-120 tablet:text-wrap tablet:text-4xl tablet:leading-10 tablet:font-light tablet:tracking-[-2px]">
          {t("auth.login.brand.headline")}
        </p>
        <p className="hidden max-w-110 text-base leading-6 tablet:block">
          {t("auth.login.brand.subtitle")}
        </p>
      </div>
    </div>
  );
}
