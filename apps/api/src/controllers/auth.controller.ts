import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type { loginRequestSchema } from "../schemas/auth.schema.js";
import { login, getCurrentUser } from "../services/auth.service.js";

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
    res.json({ data: { user: result.user, session: { token: result.token } } });
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
