import type { NextFunction, Request, Response } from "express";
import { presentWatchlistItem } from "@trading/contracts";
import type { AddWatchlistItemRequestBody } from "@trading/contracts";
import type { WatchlistService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

/** Watchlist HTTP handlers, bound to the watchlist use cases they call. */
export function makeWatchlistController(watchlistService: WatchlistService) {
  /**
   * GET /api/v1/watchlist
   * Source: 07-api-spec.md §26 (Get Watchlist), FR-022/023/024.
   */
  async function listWatchlistHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const items = await watchlistService.listWatchlist(actorOf(req));
      res.json({ data: items.map(presentWatchlistItem) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/watchlist
   * Source: 07-api-spec.md §26 (Add Asset), FR-022.
   *
   * Body validated upstream by `validate(addWatchlistItemRequestSchema, "body")`.
   */
  async function addWatchlistItemHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { assetId } = req.validated?.body as AddWatchlistItemRequestBody;

    try {
      const item = await watchlistService.addToWatchlist(actorOf(req), assetId);
      res.status(201).json({ data: presentWatchlistItem(item) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/watchlist/:assetId
   * Source: 07-api-spec.md §26 (Remove Asset), FR-023.
   */
  async function removeWatchlistItemHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      await watchlistService.removeFromWatchlist(actorOf(req), req.params.assetId as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  return { listWatchlistHandler, addWatchlistItemHandler, removeWatchlistItemHandler };
}
