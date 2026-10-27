import { createBrowserRouter } from "react-router";
import { HomePage } from "@/pages/home-page";
import { NotFoundPage } from "@/pages/not-found-page";

/** The base path comes from Vite's `base`, so a subpath deploy needs no code change (ADR-006 point 7). */
export const router = createBrowserRouter(
  [
    { path: "/", element: <HomePage /> },
    { path: "*", element: <NotFoundPage /> },
  ],
  { basename: import.meta.env.BASE_URL },
);
