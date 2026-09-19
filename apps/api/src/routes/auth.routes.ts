import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { loginRequestSchema } from "../schemas/auth.schema.js";
import { login, getCurrentUser } from "../services/auth.service.js";
import { authenticate } from "../middleware/authenticate.js";
import { AppError } from "../errors/app-error.js";

export const authRouter: ExpressRouter = Router();

authRouter.post("/api/v1/auth/login", async (req, res, next) => {
  const parsed = loginRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    next(
      new AppError(
        "VALIDATION_ERROR",
        "The request contains invalid fields.",
        400,
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      ),
    );
    return;
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password);
    res.json({ data: { user: result.user, session: { token: result.token } } });
  } catch (error) {
    next(error);
  }
});

authRouter.get("/api/v1/auth/me", authenticate, async (req, res, next) => {
  try {
    const user = await getCurrentUser(req.auth.userId);
    res.json({ data: { user } });
  } catch (error) {
    next(error);
  }
});
