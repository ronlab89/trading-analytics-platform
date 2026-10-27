import { Outlet } from "react-router";

/** The frame of every signed-in view; the bars of the Figma shell are added around the outlet. */
export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
