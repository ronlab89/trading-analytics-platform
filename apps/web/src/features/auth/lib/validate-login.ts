import { loginRequestSchema } from "@trading/contracts";

export interface LoginValues {
  email: string;
  password: string;
}

/** Which fields are wrong; the messages are the view's, so they follow the language. */
export type LoginFieldErrors = Partial<Record<keyof LoginValues, true>>;

/** Checks the form with the same schema the API uses, so both sides agree on what is valid. */
export function validateLogin(values: LoginValues): LoginFieldErrors {
  const result = loginRequestSchema.safeParse(values);
  if (result.success) return {};

  const errors: LoginFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === "email" || field === "password") errors[field] = true;
  }
  return errors;
}
