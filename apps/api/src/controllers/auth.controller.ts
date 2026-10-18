import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { presentLogin, type loginRequestSchema } from "@trading/contracts";
import { env } from "../config/env.js";
import { login, getCurrentUser } from "../services/auth.service.js";
import { REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH } from "../services/refresh-token.js";

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
    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: REFRESH_COOKIE_PATH,
      maxAge: env.SESSION_ABSOLUTE_SECONDS * 1000,
    });
    res.json({ data: presentLogin(result) });
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
