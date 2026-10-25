import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { connectDB } from "./db";
import { getEnv } from "./env";
import { isDuplicateKeyError } from "./errors";
import { logger } from "./logger";

/** `undefined` when running without a transaction (standalone MongoDB). */
export type TxSession = ClientSession | undefined;

let supported: boolean | undefined;

function isTransactionUnsupported(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { code?: number; codeName?: string; message?: string };
  return (
    e.code === 20 ||
    e.codeName === "IllegalOperation" ||
    (typeof e.message === "string" && e.message.includes("Transaction numbers are only allowed"))
  );
}

/** Thrown by `abort(value)`: rolls the unit back and makes `withTransaction` resolve to `value`. */
class TxAbort<T> {
  constructor(readonly value: T) {}
}

export type TxContext = { session: TxSession; abort: <V>(value: V) => never };

async function runOnce<T>(fn: (session: TxSession, abort: TxContext["abort"]) => Promise<T>): Promise<T> {
  const abort = <V>(value: V): never => {
    throw new TxAbort(value);
  };
  const mode = getEnv().MONGODB_TRANSACTIONS;
  if (mode === "disabled" || (mode === "auto" && supported === false)) return fn(undefined, abort);

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session, abort);
    });
    supported = true;
    return result as T;
  } catch (err) {
    if (mode === "auto" && isTransactionUnsupported(err)) {
      supported = false;
      logger.warn("mongodb.transactions_unavailable", { fallback: "idempotent-non-transactional" });
      return fn(undefined, abort);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * Run `fn` as one unit of work, inside a MongoDB transaction when the
 * deployment supports it (replica set / Atlas). On a standalone server in
 * `auto` mode it runs without a session; every workflow is idempotent and
 * has a reconciliation path (docs/DEPLOYMENT.md).
 *
 * Policy that applies to every unit:
 * - A duplicate-key error (a concurrent writer won a unique-index race)
 *   aborts the transaction, so the unit is re-run once; the retry observes
 *   the winner's committed document and takes its idempotent path.
 * - `abort(value)` rolls the unit back and resolves to `value`.
 */
export async function withTransaction<T>(fn: (session: TxSession, abort: TxContext["abort"]) => Promise<T>): Promise<T> {
  await connectDB();
  const attempt = async () => {
    try {
      return await runOnce(fn);
    } catch (err) {
      if (err instanceof TxAbort) return err.value as T;
      throw err;
    }
  };
  try {
    return await attempt();
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    return attempt();
  }
}

export function transactionsSupported(): boolean | undefined {
  return supported;
}
