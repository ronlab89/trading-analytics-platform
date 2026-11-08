import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useLogout } from "./use-logout";

/**
 * The "sign out" action of the shell menus. Signing out can fail (the revocation is rejected
 * or the service is down) and then the user stays signed in, so the failure is announced with
 * a toast; on success the session turns anonymous and the route guard sends them to the login.
 */
export function useSignOut(): () => void {
  const { t } = useTranslation();
  const { mutate } = useLogout();

  return () => {
    mutate(undefined, {
      onError: () => {
        toast.error(t("shell.signOutFailed.title"), {
          description: t("shell.signOutFailed.description"),
        });
      },
    });
  };
}
