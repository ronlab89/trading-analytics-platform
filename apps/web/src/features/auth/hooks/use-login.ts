import { useMutation } from "@tanstack/react-query";
import { useSessionService } from "@/services/session/session-provider";

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Signs in; the form reads `isPending` and `error.code` (401 bad credentials, 429 rate limit). */
export function useLogin() {
  const session = useSessionService();

  return useMutation({
    mutationKey: ["session", "login"],
    mutationFn: ({ email, password }: LoginCredentials) => session.login(email, password),
  });
}
