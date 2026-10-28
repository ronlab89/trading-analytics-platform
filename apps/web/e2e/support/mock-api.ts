import type { Page, Route } from "@playwright/test";

/** The default `VITE_API_BASE_URL` and the origin Playwright serves the app from. */
const API_ORIGIN = "http://localhost:7001";
const APP_ORIGIN = "http://localhost:4173";

export type Reply = { status: number; body?: unknown } | "network-error";

export interface ApiReplies {
  refresh: Reply;
  login: Reply;
}

export interface ApiMock {
  /** Change what an endpoint answers from now on. */
  reply: (endpoint: keyof ApiReplies, reply: Reply) => void;
  /** The bodies the app sent to the login endpoint, in order. */
  loginBodies: unknown[];
}

const user = { id: "u-1", email: "jane@example.com", displayName: "Jane", role: "TRADER" } as const;

export const signedInReply: Reply = {
  status: 200,
  body: {
    data: { user, session: { accessToken: "access-token", expiresAt: "2099-01-01T00:00:00.000Z" } },
  },
};

export function errorReply(status: number, code: string): Reply {
  return { status, body: { error: { code, message: code, requestId: "req-1" } } };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

/**
 * Stands in for the API, so the browser tests need no backend. It answers the CORS preflight
 * too, because the app and the API are on different origins.
 */
export async function mockApi(page: Page, initial: Partial<ApiReplies> = {}): Promise<ApiMock> {
  const replies: ApiReplies = {
    // By default nobody is signed in: the restore is refused, the login is wrong credentials.
    refresh: errorReply(401, "UNAUTHORIZED"),
    login: errorReply(401, "UNAUTHORIZED"),
    ...initial,
  };
  const loginBodies: unknown[] = [];

  async function answer(route: Route, reply: Reply) {
    if (reply === "network-error") {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: reply.status,
      contentType: "application/json",
      headers: corsHeaders,
      body: JSON.stringify(reply.body ?? {}),
    });
  }

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const { pathname } = new URL(request.url());
    if (pathname === "/api/v1/auth/refresh") {
      await answer(route, replies.refresh);
    } else if (pathname === "/api/v1/auth/login") {
      loginBodies.push(request.postDataJSON());
      await answer(route, replies.login);
    } else {
      await answer(route, errorReply(404, "NOT_FOUND"));
    }
  });

  return {
    reply: (endpoint, reply) => {
      replies[endpoint] = reply;
    },
    loginBodies,
  };
}
