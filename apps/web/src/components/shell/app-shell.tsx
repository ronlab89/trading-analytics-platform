import { Outlet } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityBar } from "./activity-bar";
import { StatusBar } from "./status-bar";

/**
 * The frame of every view: the activity bar and the status bar around the outlet. The user
 * and the status values are fixed samples until the session screens (FE1) and the real-time
 * connection (FE3) provide the real ones.
 */
export function AppShell() {
  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        <ActivityBar
          userInitials="JD"
          onSignOut={() => undefined}
          onViewProfile={() => undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1">
            <Outlet />
          </main>
          <StatusBar
            alertCount={1}
            calculation={{ kind: "upToDate", time: "14:32:07" }}
            connection="live"
            lastSync={{ kind: "syncedAgo", seconds: 3 }}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}
