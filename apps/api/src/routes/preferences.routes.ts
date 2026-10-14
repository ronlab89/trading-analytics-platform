import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { updateUserPreferenceRequestSchema } from "@trading/contracts";
import { makePreferencesController } from "../controllers/preferences.controller.js";
import { composition } from "../composition.js";

const { getUserPreferencesHandler, updateUserPreferencesHandler } = makePreferencesController(
  composition.userPreferenceService,
);

export const preferencesRouter: ExpressRouter = Router();

preferencesRouter.get("/api/v1/preferences", authenticate, getUserPreferencesHandler);

preferencesRouter.patch(
  "/api/v1/preferences",
  authenticate,
  validate(updateUserPreferenceRequestSchema, "body"),
  updateUserPreferencesHandler,
);
