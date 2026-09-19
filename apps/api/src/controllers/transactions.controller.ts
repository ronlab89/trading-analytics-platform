import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import type {
  createTransactionRequestSchema,
  listTransactionsQuerySchema,
} from "../schemas/transaction.schema.js";
import {
  createTransaction,
  getTransactionById,
  listTransactions,
} from "../services/transaction.service.js";
import { buildPaginationMeta } from "../schemas/pagination.schema.js";
import { Money } from "@trading/domain";

type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
type CreateTransactionRequestBody = z.infer<typeof createTransactionRequestSchema>;

/**
 * GET /api/v1/portfolios/:portfolioId/transactions
 * Source: 07-api-spec.md §13 (List Transactions), FR-014/015/016.
 *
 * Query validated upstream by `validate(listTransactionsQuerySchema, "query")`.
 */
export async function listTransactionsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { assetId, type, dateFrom, dateTo, page, pageSize } = req.validated
    ?.query as ListTransactionsQuery;

  try {
    const result = await listTransactions(
      req.auth.userId,
      req.params.portfolioId as string,
      {
        ...(assetId !== undefined ? { assetId } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(dateFrom !== undefined ? { dateFrom } : {}),
        ...(dateTo !== undefined ? { dateTo } : {}),
      },
      { page, pageSize },
    );
    res.json({ data: result.items, meta: buildPaginationMeta(page, pageSize, result.total) });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/v1/portfolios/:portfolioId/transactions/:transactionId
 * Source: 07-api-spec.md §13 (Get Transaction).
 */
export async function getTransactionByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const transaction = await getTransactionById(
      req.auth.userId,
      req.params.portfolioId as string,
      req.params.transactionId as string,
    );
    res.json({ data: transaction });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/portfolios/:portfolioId/transactions
 * Source: 07-api-spec.md §13-14 (Create Transaction), FR-017/FR-018.
 *
 * Synchronous for now — see transaction.service.ts for the rationale
 * on not implementing the async job/jobId flow yet.
 *
 * Body validated upstream by `validate(createTransactionRequestSchema, "body")`.
 */
export async function createTransactionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { assetId, type, quantity, price, fees, executedAt } = req.validated
    ?.body as CreateTransactionRequestBody;

  try {
    // Money.of validates currency shape/finiteness at construction;
    // any resulting InvalidMoneyError is caught by the same generic
    // Invalid*Error -> 400 mapping in error-handler.ts.
    const result = await createTransaction(req.auth.userId, req.params.portfolioId as string, {
      assetId,
      type,
      quantity,
      price: Money.of(price.amount, price.currency),
      ...(fees !== undefined ? { fees: Money.of(fees.amount, fees.currency) } : {}),
      ...(executedAt !== undefined ? { executedAt } : {}),
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
}
