import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  userOperations,
  type UpdateUserPreferenceRequestBody,
  type UserPreferenceResponse,
} from "@trading/contracts";
import { findOperation } from "@/api/find-operation";
import { useTradingClient } from "@/api/trading-client-provider";

const getPreferencesOperation = findOperation(userOperations, "getPreferences");
const updatePreferencesOperation = findOperation(userOperations, "updatePreferences");

export const preferenceKeys = {
  all: ["preferences"] as const,
};

/** The saved preferences of the user; `null` until the first one is saved, which is not an error. */
export function usePreferences() {
  const client = useTradingClient();

  return useQuery({
    queryKey: preferenceKeys.all,
    queryFn: async () => {
      const { data } = (await client.call(getPreferencesOperation)) as {
        data: UserPreferenceResponse | null;
      };
      return data;
    },
  });
}

/**
 * Saves some of the preferences. The answer is the whole record after the change, so it goes straight
 * into the read query instead of asking for it again.
 */
export function useUpdatePreferences() {
  const client = useTradingClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateUserPreferenceRequestBody) => {
      const { data } = (await client.call(updatePreferencesOperation, { body })) as {
        data: UserPreferenceResponse;
      };
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(preferenceKeys.all, data);
    },
  });
}
