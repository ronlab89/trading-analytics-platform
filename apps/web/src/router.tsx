import { createBrowserRouter, type RouteObject } from "react-router";
import { AppShell } from "@/components/shell/app-shell";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { LoginPage } from "@/pages/auth/login-page";
import { AnalyticsPage } from "@/pages/analytics/analytics-page";
import { DashboardPage } from "@/pages/dashboard/dashboard-page";
import { DecisionsPage } from "@/pages/decisions/decisions-page";
import { MarketsPage } from "@/pages/markets/markets-page";
import { NotFoundPage } from "@/pages/not-found/not-found-page";
import { PortfolioDetailPage } from "@/pages/portfolios/portfolio-detail-page";
import { PortfoliosPage } from "@/pages/portfolios/portfolios-page";
import { TransactionsPage } from "@/pages/transactions/transactions-page";

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
          { path: "/", element: <DashboardPage /> },
          { path: "/portfolios", element: <PortfoliosPage /> },
          { path: "/portfolios/:portfolioId", element: <PortfolioDetailPage /> },
          { path: "/transactions", element: <TransactionsPage /> },
          { path: "/analytics", element: <AnalyticsPage /> },
          { path: "/markets", element: <MarketsPage /> },
          { path: "/decisions", element: <DecisionsPage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

/** The base path comes from Vite's `base`, so a subpath deploy needs no code change (ADR-006 point 7). */
export const router = createBrowserRouter(routes, { basename: import.meta.env.BASE_URL });
