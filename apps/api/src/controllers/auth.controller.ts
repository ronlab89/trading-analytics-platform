import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { presentLogin, type loginRequestSchema } from "@trading/contracts";
import { AppError } from "../errors/app-error.js";
import { login, getCurrentUser } from "../services/auth.service.js";
import { logoutService, refreshService } from "../services/session.service.js";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "./refresh-cookie.js";

type LoginRequestBody = z.infer<typeof loginRequestSchema>;

/**
 * POST /api/v1/auth/login
 *
 * Body validated upstream by `validate(loginRequestSchema, "body")`.
 */
export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { email, password } = req.validated?.body as LoginRequestBody;

  try {
    const result = await login(email, password);
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: presentLogin(result) });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/refresh
 *
 * The refresh token comes from the cookie, never the body. Answers with the
 * login response shape and the rotated cookie; a rejected token also clears
 * the cookie, so the browser stops sending a dead one.
 */
export async function refreshHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await refreshService.refresh(readRefreshCookie(req));
    setRefreshCookie(res, result.refreshToken);
    res.json({ data: presentLogin(result) });
  } catch (error) {
    // Only a rejected token is dead; a failure of ours must not log the user out.
    if (error instanceof AppError && error.statusCode === 401) {
      clearRefreshCookie(res);
    }
    next(error);
  }
}

/**
 * POST /api/v1/auth/logout
 *
 * Revokes the session family and clears the cookie. The answer is 204 whether
 * or not the cookie held a live session.
 */
export async function logoutHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await logoutService.logout(readRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/auth/me
 */
export async function getCurrentUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await getCurrentUser(req.auth.userId);
    res.json({ data: { user } });
  } catch (error) {
    next(error);
  }
}
