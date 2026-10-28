import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useLogin } from "../hooks/use-login";
import { classifyLoginFailure, type LoginFailure } from "../lib/classify-login-failure";
import { validateLogin, type LoginFieldErrors, type LoginValues } from "../lib/validate-login";
import { LoginFormView, type LoginFormAlert } from "./login-form-view";

interface LoginFormProps {
  /** The demo entry; until it is connected the form shows the button and it does nothing. */
  onEnterDemo?: (() => void) | undefined;
}

/** Owns the form state and the sign in; `LoginFormView` draws it. */
export function LoginForm({ onEnterDemo }: LoginFormProps) {
  const { t } = useTranslation();
  const { online, recheck } = useOnlineStatus();
  const login = useLogin();
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});

  function submit() {
    const invalid = validateLogin(values);
    setFieldErrors(invalid);
    if (Object.keys(invalid).length > 0) return;
    login.mutate(values);
  }

  const failure = login.isError ? classifyLoginFailure(login.error) : undefined;

  return (
    <LoginFormView
      alert={alertFor({ online, failure, retry: submit, recheck, t })}
      errors={{
        email: fieldErrors.email ? t("auth.login.emailInvalid") : undefined,
        password: fieldErrors.password ? t("auth.login.passwordRequired") : undefined,
      }}
      offline={!online}
      onChange={(field, value) => {
        setValues((current) => ({ ...current, [field]: value }));
        setFieldErrors((current) => omitField(current, field));
      }}
      onEnterDemo={onEnterDemo}
      onSubmit={submit}
      status={login.isPending ? "submitting" : "idle"}
      values={values}
    />
  );
}

interface AlertInput {
  online: boolean;
  failure: LoginFailure | undefined;
  retry: () => void;
  recheck: () => void;
  t: TFunction;
}

/**
 * Offline wins: nothing else the server said matters until the connection is back. Its retry
 * only looks at the connection again; sending is the user's next step, once it is back.
 */
function alertFor({ online, failure, retry, recheck, t }: AlertInput): LoginFormAlert | undefined {
  if (!online) {
    return {
      tone: "warning",
      title: t("auth.login.offline.title"),
      description: t("auth.login.offline.description"),
      onRetry: recheck,
    };
  }
  if (!failure) return undefined;

  return {
    tone: "error",
    title: t(`auth.login.failure.${failure}.title`),
    description: t(`auth.login.failure.${failure}.description`),
    onRetry: failure === "unavailable" ? retry : undefined,
  };
}

function omitField(errors: LoginFieldErrors, field: keyof LoginValues): LoginFieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field));
}
