import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { loginRateLimiter } from "../middleware/rate-limit.js";
import { loginRequestSchema } from "@trading/contracts";
import { requireClientHeader } from "../middleware/require-client-header.js";
import {
  getCurrentUserHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
} from "../controllers/auth.controller.js";

export const authRouter: ExpressRouter = Router();

authRouter.post(
  "/api/v1/auth/login",
  loginRateLimiter,
  validate(loginRequestSchema, "body"),
  loginHandler,
);

authRouter.post("/api/v1/auth/refresh", requireClientHeader, refreshHandler);

authRouter.post("/api/v1/auth/logout", requireClientHeader, logoutHandler);

authRouter.get("/api/v1/auth/me", authenticate, getCurrentUserHandler);
