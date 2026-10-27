import { Outlet } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActivityBar } from "./activity-bar";

/**
 * The frame of every view: the activity bar around the outlet. The user is a fixed sample
 * until the session screens (FE1) provide the real one.
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
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
