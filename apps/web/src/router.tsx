import { createBrowserRouter } from "react-router";
import { AppShell } from "@/components/shell/app-shell";
import { HomePage } from "@/pages/home-page";
import { NotFoundPage } from "@/pages/not-found-page";

/**
 * The base path comes from Vite's `base`, so a subpath deploy needs no code change (ADR-006 point 7).
 * Only the sign-in is outside the shell; the not-found page keeps it (Figma, "Estados globales").
 */
export const router = createBrowserRouter(
  [
    {
      element: <AppShell />,
      children: [
        { path: "/", element: <HomePage /> },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
