import type { NextFunction, Request, Response } from "express";
import type { AddWatchlistItemRequestBody } from "../schemas/watchlist.schema.js";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
} from "../services/watchlist.service.js";

/**
 * GET /api/v1/watchlist
 * Source: 07-api-spec.md §26 (Get Watchlist), FR-022/023/024.
 */
export async function listWatchlistHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const items = await listWatchlist(req.auth.userId);
    res.json({ data: items });
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
export async function addWatchlistItemHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { assetId } = req.validated?.body as AddWatchlistItemRequestBody;

  try {
    const item = await addToWatchlist(req.auth.userId, assetId);
    res.status(201).json({ data: item });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/v1/watchlist/:assetId
 * Source: 07-api-spec.md §26 (Remove Asset), FR-023.
 */
export async function removeWatchlistItemHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await removeFromWatchlist(req.auth.userId, req.params.assetId as string);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
