import { useSearchParams } from "react-router";

const TAB_PARAM = "tab";

export type DecisionCenterTab = "replay" | "lab";

/** The tab is in the address (`?tab=lab`), so a link can open the Lab and Back leaves it. */
export function useDecisionCenterTab(): [DecisionCenterTab, (tab: DecisionCenterTab) => void] {
  const [params, setParams] = useSearchParams();
  const tab: DecisionCenterTab = params.get(TAB_PARAM) === "lab" ? "lab" : "replay";

  const select = (next: DecisionCenterTab) => {
    setParams(next === "lab" ? { [TAB_PARAM]: "lab" } : {}, { replace: true });
  };

  return [tab, select];
}
