import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useLogin } from "../hooks/use-login";
import { classifyLoginFailure, type LoginFailure } from "../lib/classify-login-failure";
import { demoEmailFor, readDemoRole, saveDemoRole, type DemoRole } from "../lib/demo-role";
import { validateLogin, type LoginFieldErrors, type LoginValues } from "../lib/validate-login";
import { LoginFormView, type LoginFormAlert } from "./login-form-view";

interface LoginFormProps {
  /** Whether the demo entry works; only the demo build turns it on. */
  demo?: boolean;
}

/** Owns the form state and the sign in; `LoginFormView` draws it. */
export function LoginForm({ demo = __DEMO_BUILD__ }: LoginFormProps) {
  const { t } = useTranslation();
  const { online, recheck } = useOnlineStatus();
  const login = useLogin();
  const [values, setValues] = useState<LoginValues>({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [demoRole, setDemoRole] = useState<DemoRole>(readDemoRole);
  const [enteringDemo, setEnteringDemo] = useState(false);

  function submit() {
    const invalid = validateLogin(values);
    setFieldErrors(invalid);
    if (Object.keys(invalid).length > 0) return;
    login.mutate(values);
  }

  function enterDemo() {
    setEnteringDemo(true);
    login.mutate(
      { email: demoEmailFor(demoRole), password: "demo" },
      {
        onSettled: () => {
          setEnteringDemo(false);
        },
      },
    );
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
      demoRole={
        demo
          ? {
              value: demoRole,
              onChange: (role) => {
                setDemoRole(role);
                saveDemoRole(role);
              },
            }
          : undefined
      }
      onEnterDemo={demo ? enterDemo : undefined}
      onSubmit={submit}
      status={login.isPending ? (enteringDemo ? "entering-demo" : "submitting") : "idle"}
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
