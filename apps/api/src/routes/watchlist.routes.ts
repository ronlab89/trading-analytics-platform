import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { addWatchlistItemRequestSchema } from "../schemas/watchlist.schema.js";
import {
  addWatchlistItemHandler,
  listWatchlistHandler,
  removeWatchlistItemHandler,
} from "../controllers/watchlist.controller.js";

export const watchlistRouter: ExpressRouter = Router();

watchlistRouter.get("/api/v1/watchlist", authenticate, listWatchlistHandler);

watchlistRouter.post(
  "/api/v1/watchlist",
  authenticate,
  validate(addWatchlistItemRequestSchema, "body"),
  addWatchlistItemHandler,
);

watchlistRouter.delete("/api/v1/watchlist/:assetId", authenticate, removeWatchlistItemHandler);
