import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSessionService } from "@/services/session/session-provider";

/**
 * Signs out and drops every cached query: the next user must never see this one's data.
 * When the revocation fails the user stays signed in, so the cache stays too.
 */
export function useLogout() {
  const session = useSessionService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["session", "logout"],
    mutationFn: () => session.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
