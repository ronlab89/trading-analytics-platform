import { presentPortfolio } from "@trading/contracts";
import type { CreatePortfolioRequestBody, UpdatePortfolioRequestBody } from "@trading/contracts";
import type { HandlerContext, HandlerRegistry } from "./handler";

interface PortfolioParams {
  readonly portfolioId: string;
}

/** Mirrors `apps/api/src/controllers/portfolios.controller.ts`, on the same service. */
export function createPortfolioHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { portfolioService, actor } = composition;

  return {
    listPortfolios: async () => {
      const portfolios = await portfolioService.listPortfolios(actor);
      return { data: portfolios.map(presentPortfolio) };
    },
    createPortfolio: async ({ body }) => {
      const { name, baseCurrency, description } = body as CreatePortfolioRequestBody;
      const portfolio = await portfolioService.createPortfolio(actor, {
        name,
        baseCurrency,
        ...(description !== undefined ? { description } : {}),
      });
      return { data: presentPortfolio(portfolio) };
    },
    getPortfolio: async ({ params }) => {
      const { portfolioId } = params as PortfolioParams;
      const portfolio = await portfolioService.getPortfolioById(actor, portfolioId);
      return { data: presentPortfolio(portfolio) };
    },
    updatePortfolio: async ({ params, body }) => {
      const { portfolioId } = params as PortfolioParams;
      const { name, description } = body as UpdatePortfolioRequestBody;
      const portfolio = await portfolioService.updatePortfolio(actor, portfolioId, {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      });
      return { data: presentPortfolio(portfolio) };
    },
    archivePortfolio: async ({ params }) => {
      const { portfolioId } = params as PortfolioParams;
      const { portfolio, alreadyArchived } = await portfolioService.archivePortfolio(
        actor,
        portfolioId,
      );
      return { data: presentPortfolio(portfolio), meta: { alreadyArchived } };
    },
  };
}
