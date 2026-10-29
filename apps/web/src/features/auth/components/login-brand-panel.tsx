import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import brandDesktop from "@/assets/login/brand-desktop.webp";
import brandMobile from "@/assets/login/brand-mobile.webp";
import brandTablet from "@/assets/login/brand-tablet.webp";
import { Logo } from "@/components/logo";

/**
 * The Figma "Panel de marca": the brand and the message over the Figma background (a gradient
 * with its texture layers, exported once per layout because its crop differs in each). It is a
 * panel on desktop and tablet and a strip on mobile, where the subtitle is left out.
 */
export function LoginBrandPanel() {
  const { t } = useTranslation();

  return (
    <div
      className="flex h-50 shrink-0 flex-col justify-between bg-(--color-brand-brand-gradient-from) bg-(image:--brand-mobile) bg-cover bg-center px-6 pt-10 pb-8 text-(--color-text-on-brand) tablet:h-72 tablet:rounded-xl tablet:bg-(image:--brand-tablet) tablet:p-10 desktop:h-auto desktop:flex-1 desktop:bg-(image:--brand-desktop)"
      style={
        {
          "--brand-mobile": `url(${brandMobile})`,
          "--brand-tablet": `url(${brandTablet})`,
          "--brand-desktop": `url(${brandDesktop})`,
        } as CSSProperties
      }
    >
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
