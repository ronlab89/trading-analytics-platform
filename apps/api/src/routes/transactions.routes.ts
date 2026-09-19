import { Router } from "express";
import type { Router as ExpressRouter } from "express";
import { authenticate } from "../middleware/authenticate.js";
import {
  createTransactionRequestSchema,
  listTransactionsQuerySchema,
} from "../schemas/transaction.schema.js";
import {
  createTransaction,
  getTransactionById,
  listTransactions,
} from "../services/transaction.service.js";
import { AppError } from "../errors/app-error.js";
import { Money } from "../../../../packages/domain/src/index.js";

export const transactionsRouter: ExpressRouter = Router();

/**
 * GET /api/v1/portfolios/:portfolioId/transactions
 * Source: 07-api-spec.md §13 (List Transactions), FR-014/015/016.
 */
transactionsRouter.get(
  "/api/v1/portfolios/:portfolioId/transactions",
  authenticate,
  async (req, res, next) => {
    const parsedQuery = listTransactionsQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
      next(
        new AppError(
          "VALIDATION_ERROR",
          "The request contains invalid query parameters.",
          400,
          parsedQuery.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    const { assetId, type, dateFrom, dateTo } = parsedQuery.data;

    try {
      const transactions = await listTransactions(
        req.auth.userId,
        req.params.portfolioId as string,
        {
          ...(assetId !== undefined ? { assetId } : {}),
          ...(type !== undefined ? { type } : {}),
          ...(dateFrom !== undefined ? { dateFrom } : {}),
          ...(dateTo !== undefined ? { dateTo } : {}),
        },
      );
      res.json({ data: transactions });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/portfolios/:portfolioId/transactions/:transactionId
 * Source: 07-api-spec.md §13 (Get Transaction).
 */
transactionsRouter.get(
  "/api/v1/portfolios/:portfolioId/transactions/:transactionId",
  authenticate,
  async (req, res, next) => {
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
  },
);

/**
 * POST /api/v1/portfolios/:portfolioId/transactions
 * Source: 07-api-spec.md §13-14 (Create Transaction), FR-017/FR-018.
 *
 * Synchronous for now — see transaction.service.ts for the rationale
 * on not implementing the async job/jobId flow yet.
 */
transactionsRouter.post(
  "/api/v1/portfolios/:portfolioId/transactions",
  authenticate,
  async (req, res, next) => {
    const parsed = createTransactionRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      next(
        new AppError(
          "VALIDATION_ERROR",
          "The request contains invalid fields.",
          400,
          parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    const { assetId, type, quantity, price, fees, executedAt } = parsed.data;

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
  },
);
