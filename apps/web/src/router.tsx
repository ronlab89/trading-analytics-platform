import { createBrowserRouter, type RouteObject } from "react-router";
import { AppShell } from "@/components/shell/app-shell";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { PortfoliosPage } from "@/pages/portfolios-page";

/**
 * Only the login is public and outside the shell; everything else, the not-found page
 * included (Figma, "Estados globales"), needs a session and keeps the shell.
 */
export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/", element: <HomePage /> },
          { path: "/portfolios", element: <PortfoliosPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

/** The base path comes from Vite's `base`, so a subpath deploy needs no code change (ADR-006 point 7). */
export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
