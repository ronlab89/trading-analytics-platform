import { useConnectionStatus } from "@/hooks/use-connection-status";
import { StatusBar } from "./status-bar";

interface ConnectedStatusBarProps {
  alertCount: number;
  /** The last calculation, until the analytics report their own. */
  calculationTime: string;
}

/**
 * The status bar with the real connection. It lives apart from the shell so that the clock that
 * counts the seconds renders only the footer, never the routed view.
 */
export function ConnectedStatusBar({ alertCount, calculationTime }: ConnectedStatusBarProps) {
  const status = useConnectionStatus(calculationTime);
  return <StatusBar {...status} alertCount={alertCount} />;
}
