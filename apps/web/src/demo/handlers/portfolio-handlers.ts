import { presentPortfolio } from "@trading/contracts";
import type { HandlerContext, HandlerRegistry } from "./handler";

export function createPortfolioHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { portfolioService, actor } = composition;

  return {
    listPortfolios: async () => {
      const portfolios = await portfolioService.listPortfolios(actor);
      return { data: portfolios.map(presentPortfolio) };
    },
  };
}
