import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { loginRateLimiter } from "../middleware/rate-limit.js";
import { loginRequestSchema } from "../schemas/auth.schema.js";
import { getCurrentUserHandler, loginHandler } from "../controllers/auth.controller.js";

export const authRouter: ExpressRouter = Router();

authRouter.post(
  "/api/v1/auth/login",
  loginRateLimiter,
  validate(loginRequestSchema, "body"),
  loginHandler,
);

authRouter.get("/api/v1/auth/me", authenticate, getCurrentUserHandler);
