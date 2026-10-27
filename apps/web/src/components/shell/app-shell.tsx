import { Outlet } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityBar } from "./activity-bar";
import { StatusBar } from "./status-bar";

/**
 * The frame of every view: floating panels (activity bar, status bar) with 8 px around them
 * and between them, and the routed view scrolling in the middle, as in the Figma layout. The user
 * and the status values are fixed samples until the session screens (FE1) and the real-time
 * connection (FE3) provide the real ones.
 */
export function AppShell() {
  return (
    <TooltipProvider>
      <div className="flex h-screen gap-2 p-2">
        <ActivityBar
          userInitials="JD"
          userName="Jane Doe"
          onSignOut={() => undefined}
          onViewProfile={() => undefined}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <main className="min-h-0 flex-1 overflow-y-auto pt-2 pr-4 pb-4 pl-2">
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
