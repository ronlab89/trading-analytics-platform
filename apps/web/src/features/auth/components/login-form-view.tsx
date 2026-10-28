import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import type { LoginValues } from "../lib/validate-login";

export type LoginFormStatus = "idle" | "submitting" | "entering-demo";

export interface LoginFormAlert {
  tone: ComponentProps<typeof Alert>["tone"];
  title: string;
  description: string;
  /** When present, the alert offers "Try again". */
  onRetry?: (() => void) | undefined;
}

export interface LoginFormViewProps {
  values: LoginValues;
  /** Already translated messages, by field. */
  errors: Partial<Record<keyof LoginValues, string | undefined>>;
  status: LoginFormStatus;
  /** Without a connection the user cannot sign in, but can still type. */
  offline: boolean;
  alert?: LoginFormAlert | undefined;
  onChange: (field: keyof LoginValues, value: string) => void;
  onSubmit: () => void;
  /** The demo entry; until it is connected the button shows and does nothing. */
  onEnterDemo?: (() => void) | undefined;
}

/** The login form as the Figma "Acceso" frames draw it: fields, alert, actions and demo. */
export function LoginFormView({
  values,
  errors,
  status,
  offline,
  alert,
  onChange,
  onSubmit,
  onEnterDemo,
}: LoginFormViewProps) {
  const { t } = useTranslation();
  const submitting = status === "submitting";
  const enteringDemo = status === "entering-demo";
  const busy = submitting || enteringDemo;

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-4">
        <Field disabled={busy} error={errors.email} label={t("auth.login.email")}>
          <Input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => {
              onChange("email", event.target.value);
            }}
            type="email"
            value={values.email}
          />
        </Field>
        <Field disabled={busy} error={errors.password} label={t("auth.login.password")}>
          <PasswordInput
            autoComplete="current-password"
            hideLabel={t("auth.login.hidePassword")}
            onChange={(event) => {
              onChange("password", event.target.value);
            }}
            showLabel={t("auth.login.showPassword")}
            value={values.password}
          />
        </Field>
      </div>

      {alert ? (
        <Alert
          action={
            alert.onRetry ? (
              <Button onClick={alert.onRetry} size="sm" type="button" variant="outline">
                {t("auth.login.retry")}
              </Button>
            ) : undefined
          }
          description={alert.description}
          title={alert.title}
          tone={alert.tone}
        />
      ) : null}

      <Button
        className="w-full"
        disabled={offline || enteringDemo}
        loading={submitting}
        size="lg"
        type="submit"
      >
        {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
      </Button>

      <div
        aria-hidden="true"
        className="flex items-center gap-3 text-xs text-(--color-text-secondary)"
      >
        <span className="h-px flex-1 bg-(--color-border-default)" />
        {t("auth.login.or")}
        <span className="h-px flex-1 bg-(--color-border-default)" />
      </div>

      <Button
        className="w-full"
        disabled={offline || submitting}
        loading={enteringDemo}
        onClick={onEnterDemo}
        size="lg"
        type="button"
        variant="outline"
      >
        {enteringDemo ? t("auth.login.enteringDemo") : t("auth.login.enterDemo")}
      </Button>
      <p className="text-center text-xs leading-4 text-(--color-text-secondary)">
        {t("auth.login.demoNote")}
      </p>
    </form>
  );
}
