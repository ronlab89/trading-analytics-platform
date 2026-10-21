import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import {
  buildPaginationMeta,
  presentCreateTransactionResult,
  presentTransaction,
  type createTransactionRequestSchema,
  type listTransactionsQuerySchema,
} from "@trading/contracts";
import type { IdempotencyService, TransactionService } from "@trading/application";
import { Money } from "@trading/domain";
import { actorOf } from "../middleware/authenticate.js";
import { idempotencyOf } from "../middleware/idempotency.js";

type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
type CreateTransactionRequestBody = z.infer<typeof createTransactionRequestSchema>;

/** Transaction HTTP handlers, bound to the transaction use cases they call. */
export function makeTransactionsController(
  transactionService: TransactionService,
  idempotencyService: Pick<IdempotencyService, "complete">,
) {
  /**
   * GET /api/v1/portfolios/:portfolioId/transactions
   * Source: 07-api-spec.md §13 (List Transactions), FR-014/015/016.
   *
   * Query validated upstream by `validate(listTransactionsQuerySchema, "query")`.
   */
  async function listTransactionsHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { assetId, type, dateFrom, dateTo, page, pageSize } = req.validated
      ?.query as ListTransactionsQuery;

    try {
      const result = await transactionService.listTransactions(
        actorOf(req),
        req.params.portfolioId as string,
        {
          ...(assetId !== undefined ? { assetId } : {}),
          ...(type !== undefined ? { type } : {}),
          ...(dateFrom !== undefined ? { dateFrom } : {}),
          ...(dateTo !== undefined ? { dateTo } : {}),
        },
        { page, pageSize },
      );
      res.json({
        data: result.items.map(({ transaction, realizedPnL }) =>
          presentTransaction(transaction, realizedPnL),
        ),
        meta: buildPaginationMeta(page, pageSize, result.total),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/portfolios/:portfolioId/transactions/:transactionId
   * Source: 07-api-spec.md §13 (Get Transaction).
   */
  async function getTransactionByIdHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { transaction, realizedPnL } = await transactionService.getTransactionById(
        actorOf(req),
        req.params.portfolioId as string,
        req.params.transactionId as string,
      );
      res.json({ data: presentTransaction(transaction, realizedPnL) });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/portfolios/:portfolioId/transactions
   * Source: 07-api-spec.md §13-14 (Create Transaction), FR-017/FR-018.
   *
   * Synchronous for now: see transaction-service.ts for why the async
   * job/jobId flow is not implemented yet.
   *
   * Body validated upstream by `validate(createTransactionRequestSchema, "body")`.
   */
  async function createTransactionHandler(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const { assetId, type, quantity, price, fees, executedAt } = req.validated
      ?.body as CreateTransactionRequestBody;

    const idempotent = idempotencyOf(res);

    try {
      // Money.of validates currency shape/finiteness at construction;
      // any resulting InvalidMoneyError is caught by the same generic
      // Invalid*Error -> 400 mapping in error-handler.ts.
      const result = await transactionService.createTransaction(
        actorOf(req),
        req.params.portfolioId as string,
        {
          assetId,
          type,
          quantity,
          price: Money.of(price.amount, price.currency),
          ...(fees !== undefined ? { fees: Money.of(fees.amount, fees.currency) } : {}),
          ...(executedAt !== undefined ? { executedAt } : {}),
        },
        // With an `Idempotency-Key`, the response is stored in the same unit of
        // work as the transaction, so the key and the change commit together.
        idempotent
          ? async (created, repositories) => {
              await idempotencyService.complete(
                {
                  ...idempotent,
                  responseStatus: 201,
                  responseBody: { data: presentCreateTransactionResult(created) },
                },
                repositories.idempotencyKeys,
              );
            }
          : undefined,
      );
      res.status(201).json({ data: presentCreateTransactionResult(result) });
    } catch (error) {
      next(error);
    }
  }

  return { listTransactionsHandler, getTransactionByIdHandler, createTransactionHandler };
}
