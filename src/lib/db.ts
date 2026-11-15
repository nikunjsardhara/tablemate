import { Pool, type PoolClient } from "pg";

/**
 * SSL is driven by an explicit env flag rather than NODE_ENV, because both
 * local dev (through the Cloud SQL Auth Proxy) and Cloud Run (through the
 * unix socket at /cloudsql/<connection-name>) connect without TLS.
 */
const useSsl = process.env.DATABASE_SSL === "true";

const globalForPool = globalThis as unknown as { __tablematePool?: Pool };

export const pool =
  globalForPool.__tablematePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
  });

// Reuse the pool across HMR reloads in development.
if (process.env.NODE_ENV !== "production") {
  globalForPool.__tablematePool = pool;
}

type Executor = Pick<PoolClient, "query">;

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
  executor: Executor = pool
): Promise<T[]> {
  const result = await executor.query(text, params as never[]);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
  executor: Executor = pool
): Promise<T | null> {
  const rows = await query<T>(text, params, executor);
  return rows[0] ?? null;
}

/**
 * Runs `fn` inside a transaction, rolling back on any thrown error.
 * Used where a listing is written across two tables and a partial write would
 * leave questions orphaned.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
