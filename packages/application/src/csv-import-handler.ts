import {
  InsufficientPositionQuantityError,
  InvalidTransactionError,
  Money,
  PortfolioStatus,
  TransactionStatus,
  TransactionType,
  applyBuy,
  applySell,
  replayPosition,
  sortByExecutedAt,
  validateNewTransaction,
} from "@trading/domain";
import type {
  Asset,
  AssetRepository,
  CreateTransactionInput,
  Job,
  JobRowError,
  Portfolio,
  PortfolioRepository,
  ReplayEntry,
  ReplayedPosition,
  Transaction,
  TransactionRepository,
  UnitOfWork,
} from "@trading/domain";
import type { Clock } from "./clock.js";
import { parseImportCsv } from "./csv-import.js";
import type { CsvTokenizer, ImportRow } from "./csv-import.js";
import {
  JobApplyRejectedError,
  JobPortfolioArchivedError,
  JobSupersededError,
} from "./job-runner.js";
import type { JobApplyContext, JobHandler, JobValidationResult } from "./job-runner.js";

/** Rows checked between two progress reports. */
const PROGRESS_EVERY = 100;

export interface CsvImportHandlerDependencies {
  /** Splits the CSV text into records; the API wires `csv-parse` (see `csv-import.ts`). */
  tokenize: CsvTokenizer;
  portfolioRepository: Pick<PortfolioRepository, "getById">;
  assetRepository: Pick<AssetRepository, "getBySymbol">;
  /** Reads the history the validation stage checks the file against. */
  transactionRepository: Pick<TransactionRepository, "listByPortfolioAndAsset">;
  /** Writes every row, the positions and the job's completion as one unit (ADR-008 points 2 and 5). */
  unitOfWork: UnitOfWork;
  clock: Clock;
}

/** A row that passed its own checks, tied to the asset it names. */
interface ResolvedRow {
  readonly source: ImportRow;
  readonly asset: Asset;
  readonly input: CreateTransactionInput;
}

function replayEntryOf(input: CreateTransactionInput, currency: string): ReplayEntry {
  return {
    type: input.type,
    quantity: input.quantity,
    price: input.price,
    fees: input.fees ?? Money.zero(currency),
    executedAt: input.executedAt ?? new Date(0),
  };
}

function toInput(row: ImportRow, asset: Asset, portfolio: Portfolio): CreateTransactionInput {
  const currency = portfolio.baseCurrency;

  return {
    portfolioId: portfolio.id,
    assetId: asset.id,
    type: row.type,
    quantity: row.quantity,
    price: Money.of(row.price, currency),
    ...(row.fees === null ? {} : { fees: Money.of(row.fees, currency) }),
    executedAt: row.executedAt,
  };
}

function groupByAsset(rows: readonly ResolvedRow[]): Map<string, ResolvedRow[]> {
  const groups = new Map<string, ResolvedRow[]>();

  for (const row of rows) {
    groups.set(row.asset.id, [...(groups.get(row.asset.id) ?? []), row]);
  }

  return groups;
}

/**
 * Walks an asset's history and the file's rows in date order (the history
 * first on a tie, the rows in file order) and reports each SELL that would
 * exceed what is held at its place in the timeline (FR-018, ADR-003).
 *
 * A SELL that fails is left out of the walk, so the rows after it are still
 * judged against what the portfolio would really hold.
 */
function findOversells(
  history: readonly Transaction[],
  rows: readonly ResolvedRow[],
): JobRowError[] {
  const errors: JobRowError[] = [];
  const entries = [
    ...history.map((transaction) => ({ entry: transaction, row: null })),
    ...rows.map((resolved) => ({
      entry: replayEntryOf(resolved.input, resolved.input.price.currency),
      row: resolved.source.row,
    })),
  ];
  const ordered = [...entries].sort(
    (a, b) => a.entry.executedAt.getTime() - b.entry.executedAt.getTime(),
  );
  let position: ReplayedPosition | null = null;

  for (const { entry, row } of ordered) {
    if (entry.type === TransactionType.BUY) {
      position = applyBuy(position, entry);
      continue;
    }

    try {
      position = applySell(position, entry);
    } catch (error) {
      if (!(error instanceof InsufficientPositionQuantityError) || row === null) {
        throw error;
      }

      errors.push({ row, message: error.message });
    }
  }

  return errors;
}

/**
 * The CSV transaction import (ADR-008 points 1, 2 and 10), as the two stages
 * the job runner drives.
 *
 * `validate` writes nothing. It reports, with their row, every problem it finds
 * in tiers: the file's format first; then each row against the assets, the
 * portfolio's currency and the transaction rules; and only when a row set is
 * clean of those, the chronological check against the position history. A later
 * tier is skipped while an earlier one has findings, because a row that failed
 * would make the rows after it look wrong.
 *
 * `apply` re-checks everything inside the unit of work that writes the rows, so
 * a history that changed since the validation is a rejection and not a
 * negative position, and it completes the job in that same unit.
 */
export function createCsvImportHandler(dependencies: CsvImportHandlerDependencies): JobHandler {
  const {
    tokenize,
    portfolioRepository,
    assetRepository,
    transactionRepository,
    unitOfWork,
    clock,
  } = dependencies;

  /** Looks up each distinct symbol once. */
  async function resolveAssets(symbols: readonly string[]): Promise<Map<string, Asset | null>> {
    const assets = new Map<string, Asset | null>();

    for (const symbol of new Set(symbols)) {
      assets.set(symbol, await assetRepository.getBySymbol(symbol));
    }

    return assets;
  }

  /** The row-level checks that need the assets and the portfolio; the rows that pass are resolved. */
  function resolveRows(
    rows: readonly ImportRow[],
    assets: ReadonlyMap<string, Asset | null>,
    portfolio: Portfolio,
    now: Date,
  ): { resolved: ResolvedRow[]; errors: JobRowError[] } {
    const resolved: ResolvedRow[] = [];
    const errors: JobRowError[] = [];

    for (const source of rows) {
      const asset = assets.get(source.symbol);

      if (!asset) {
        errors.push({ row: source.row, message: `Unknown asset ${source.symbol}.` });
        continue;
      }

      if (asset.currency !== portfolio.baseCurrency) {
        errors.push({
          row: source.row,
          message: `${source.symbol} is in ${asset.currency} but the portfolio is in ${portfolio.baseCurrency}.`,
        });
        continue;
      }

      const input = toInput(source, asset, portfolio);

      try {
        validateNewTransaction(input, now);
        resolved.push({ source, asset, input });
      } catch (error) {
        if (!(error instanceof InvalidTransactionError)) {
          throw error;
        }

        errors.push({ row: source.row, message: error.message });
      }
    }

    return { resolved, errors };
  }

  async function validate(
    job: Job,
    report: (processed: number, total: number) => Promise<boolean>,
  ): Promise<JobValidationResult> {
    const parsed = parseImportCsv(job.input ?? "", tokenize);
    const total = parsed.rows.length;

    if (parsed.errors.length > 0) {
      return { total, errors: parsed.errors };
    }

    const portfolio = await portfolioRepository.getById(job.portfolioId);

    if (!portfolio) {
      return { total, errors: [{ row: 0, message: "The portfolio no longer exists." }] };
    }

    const assets = await resolveAssets(parsed.rows.map((row) => row.symbol));
    const now = clock.now();
    const errors: JobRowError[] = [];
    const resolved: ResolvedRow[] = [];

    for (let start = 0; start < parsed.rows.length; start += PROGRESS_EVERY) {
      const chunk = resolveRows(
        parsed.rows.slice(start, start + PROGRESS_EVERY),
        assets,
        portfolio,
        now,
      );
      resolved.push(...chunk.resolved);
      errors.push(...chunk.errors);

      if (!(await report(Math.min(start + PROGRESS_EVERY, total), total))) {
        return { total, errors: [] };
      }
    }

    if (errors.length > 0) {
      return { total, errors };
    }

    for (const [assetId, rows] of groupByAsset(resolved)) {
      const history = await transactionRepository.listByPortfolioAndAsset(portfolio.id, assetId);
      errors.push(...findOversells(history, rows));
    }

    return { total, errors: errors.sort((a, b) => a.row - b.row) };
  }

  async function apply(job: Job, context: JobApplyContext): Promise<void> {
    const parsed = parseImportCsv(job.input ?? "", tokenize);

    if (parsed.errors.length > 0) {
      throw new JobApplyRejectedError("The stored file no longer passes validation.");
    }

    try {
      await unitOfWork.run(async ({ transactions, positions, jobs }) => {
        const portfolio = await portfolioRepository.getById(job.portfolioId);

        if (!portfolio) {
          throw new JobApplyRejectedError("The portfolio no longer exists.");
        }

        // An archived portfolio is read-only (ADR-010 point 5): nothing is written.
        if (portfolio.status === PortfolioStatus.ARCHIVED) {
          throw new JobPortfolioArchivedError(
            "The portfolio was archived before the import applied.",
          );
        }

        const assets = await resolveAssets(parsed.rows.map((row) => row.symbol));
        const { resolved, errors } = resolveRows(parsed.rows, assets, portfolio, clock.now());

        if (errors.length > 0) {
          throw new JobApplyRejectedError(errors[0]?.message ?? "A row is no longer valid.");
        }

        const groups = groupByAsset(resolved);
        const histories = new Map<string, Transaction[]>();

        // One lock order for every import, so two imports never wait on each other in a cycle.
        for (const assetId of [...groups.keys()].sort()) {
          await transactions.lockPortfolioAsset(portfolio.id, assetId);
          histories.set(assetId, await transactions.listByPortfolioAndAsset(portfolio.id, assetId));
        }

        // Rows are created in date order, the file order breaking ties, as the history is read back.
        const created = [...resolved].sort(
          (a, b) => a.source.executedAt.getTime() - b.source.executedAt.getTime(),
        );

        for (const row of created) {
          const transaction = await transactions.create(row.input);
          await transactions.updateStatus(transaction.id, TransactionStatus.COMPLETED);
        }

        for (const [assetId, rows] of groups) {
          const history = histories.get(assetId) ?? [];
          // Throws when a SELL exceeds what is held at its place in the timeline.
          const replayed = replayPosition([
            ...history,
            ...rows.map((row) => replayEntryOf(row.input, portfolio.baseCurrency)),
          ]);
          const existing = await positions.getByPortfolioAndAsset(portfolio.id, assetId);

          if (replayed === null) {
            if (existing) {
              await positions.deleteByPortfolioAndAsset(portfolio.id, assetId);
            }
            continue;
          }

          const last = sortByExecutedAt(
            rows.map((row) => replayEntryOf(row.input, portfolio.baseCurrency)),
          ).at(-1);

          await positions.upsert({
            portfolioId: portfolio.id,
            assetId,
            quantity: replayed.quantity,
            averageEntryPrice: replayed.averageEntryPrice,
            // Tracks market data (FR-045): seeded from the latest imported price only when first opened.
            currentPrice: existing?.currentPrice ?? last?.price ?? replayed.averageEntryPrice,
            openedAt: replayed.openedAt,
          });
        }

        // Conditional: if the job moved on, nothing above may commit.
        if (!(await context.complete(jobs))) {
          throw new JobSupersededError();
        }
      });
    } catch (error) {
      if (
        error instanceof InsufficientPositionQuantityError ||
        error instanceof InvalidTransactionError
      ) {
        throw new JobApplyRejectedError(error.message);
      }

      throw error;
    }
  }

  return { validate, apply };
}
