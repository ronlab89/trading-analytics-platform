import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { presentPortfolio } from "@trading/contracts";
import type {
  createPortfolioRequestSchema,
  updatePortfolioRequestSchema,
} from "@trading/contracts";
import type { PortfolioService } from "@trading/application";
import { actorOf } from "../middleware/authenticate.js";

type CreatePortfolioRequestBody = z.infer<typeof createPortfolioRequestSchema>;
type UpdatePortfolioRequestBody = z.infer<typeof updatePortfolioRequestSchema>;

/** Portfolio HTTP handlers, bound to the portfolio use cases they call. */
export function makePortfoliosController(service: PortfolioService) {
  /**
   * GET /api/v1/portfolios
   * Source: 07-api-spec.md §10 (List Portfolios), FR-008.
   *
   * Always scoped to the authenticated caller — there is no "list all
   * portfolios" operation exposed by this API.
   */
  async function listPortfoliosHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const portfolios = await service.listPortfolios(actorOf(req));
      res.json({ data: portfolios.map(presentPortfolio) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portfolios
   * Source: 07-api-spec.md §10 (Create Portfolio), FR-009.
   *
   * Body validated upstream by `validate(createPortfolioRequestSchema, "body")`.
   */
  async function createPortfolioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { name, baseCurrency, description } = req.validated?.body as CreatePortfolioRequestBody;

    try {
      // Conditional spread instead of passing `description` straight
      // through: with `exactOptionalPropertyTypes: true`, an optional
      // field must be omitted entirely when absent, never assigned
      // `undefined` explicitly (same pattern already established in
      // error-handler.ts for AppError.details).
      const portfolio = await service.createPortfolio(actorOf(req), {
        name,
        baseCurrency,
        ...(description !== undefined ? { description } : {}),
      });
      res.status(201).json({ data: presentPortfolio(portfolio) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolios/:portfolioId
   * Source: 07-api-spec.md §10 (Get Portfolio), FR-008.
   *
   * Ownership is enforced in the service layer: a portfolio belonging to
   * another user resolves to 404, identically to a non-existent
   * portfolio (09-security-spec.md §14-15, IDOR Protection).
   */
  async function getPortfolioByIdHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const portfolio = await service.getPortfolioById(
        actorOf(req),
        req.params.portfolioId as string,
      );
      res.json({ data: presentPortfolio(portfolio) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/portfolios/:portfolioId
   * Source: 07-api-spec.md §10 (Update Portfolio), FR-010.
   *
   * Only `name` and `description` are editable — see
   * updatePortfolioRequestSchema for the rationale on excluding
   * `baseCurrency`. Ownership is enforced the same way as GET by id.
   *
   * Body validated upstream by `validate(updatePortfolioRequestSchema, "body")`.
   */
  async function updatePortfolioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { name, description } = req.validated?.body as UpdatePortfolioRequestBody;

    try {
      const portfolio = await service.updatePortfolio(
        actorOf(req),
        req.params.portfolioId as string,
        {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      );
      res.json({ data: presentPortfolio(portfolio) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portfolios/:portfolioId/archive
   * Source: 07-api-spec.md §10 (Archive Portfolio), FR-011.
   *
   * Idempotent: always returns 200, never 409. `meta.alreadyArchived`
   * tells the caller whether this call actually changed anything, so the
   * frontend can show the appropriate feedback (see portfolio.service.ts
   * for the full rationale).
   */
  async function archivePortfolioHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { portfolio, alreadyArchived } = await service.archivePortfolio(
        actorOf(req),
        req.params.portfolioId as string,
      );
      res.json({ data: presentPortfolio(portfolio), meta: { alreadyArchived } });
    } catch (error) {
      next(error);
    }
  }

  return {
    listPortfoliosHandler,
    createPortfolioHandler,
    getPortfolioByIdHandler,
    updatePortfolioHandler,
    archivePortfolioHandler,
  };
}
