import {
  buildPaginationMeta,
  presentCreateTransactionResult,
  presentPosition,
  presentPositionDetail,
  presentTransaction,
} from "@trading/contracts";
import type {
  createTransactionRequestSchema,
  listTransactionsQuerySchema,
} from "@trading/contracts";
import { Money } from "@trading/domain";
import type { z } from "zod";
import type { HandlerContext, HandlerRegistry } from "./handler";

type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
type CreateTransactionBody = z.infer<typeof createTransactionRequestSchema>;

interface PortfolioParams {
  readonly portfolioId: string;
}

/** Mirrors `transactions.controller.ts` and `positions.controller.ts` of the API, on the same services. */
export function createTransactionHandlers({ composition }: HandlerContext): HandlerRegistry {
  const { transactionService, positionService, actor } = composition;

  return {
    listTransactions: async ({ params, query }) => {
      const { portfolioId } = params as PortfolioParams;
      const { assetId, type, dateFrom, dateTo, page, pageSize } = query as ListTransactionsQuery;
      const result = await transactionService.listTransactions(
        actor,
        portfolioId,
        {
          ...(assetId !== undefined ? { assetId } : {}),
          ...(type !== undefined ? { type } : {}),
          ...(dateFrom !== undefined ? { dateFrom } : {}),
          ...(dateTo !== undefined ? { dateTo } : {}),
        },
        { page, pageSize },
      );
      return {
        data: result.items.map(({ transaction, realizedPnL }) =>
          presentTransaction(transaction, realizedPnL),
        ),
        meta: buildPaginationMeta(page, pageSize, result.total),
      };
    },
    getTransaction: async ({ params }) => {
      const { portfolioId, transactionId } = params as PortfolioParams & {
        transactionId: string;
      };
      const { transaction, realizedPnL } = await transactionService.getTransactionById(
        actor,
        portfolioId,
        transactionId,
      );
      return { data: presentTransaction(transaction, realizedPnL) };
    },
    createTransaction: async ({ params, body }) => {
      const { portfolioId } = params as PortfolioParams;
      const { assetId, type, quantity, price, fees, executedAt } = body as CreateTransactionBody;
      const result = await transactionService.createTransaction(actor, portfolioId, {
        assetId,
        type,
        quantity,
        price: Money.of(price.amount, price.currency),
        ...(fees !== undefined ? { fees: Money.of(fees.amount, fees.currency) } : {}),
        ...(executedAt !== undefined ? { executedAt } : {}),
      });
      return { data: presentCreateTransactionResult(result) };
    },
    listPositions: async ({ params }) => {
      const { portfolioId } = params as PortfolioParams;
      const positions = await positionService.listPositions(actor, portfolioId);
      return { data: positions.map(presentPosition) };
    },
    getPosition: async ({ params }) => {
      const { portfolioId, positionId } = params as PortfolioParams & { positionId: string };
      const detail = await positionService.getPositionById(actor, portfolioId, positionId);
      return { data: presentPositionDetail(detail) };
    },
  };
}
