import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

import { loadConfig } from "./config.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPath = resolve(currentDir, "../../../packages/db/migrations/0001_socialops_core.sql");

export type Db = {
  pool: Pool;
  query: <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => Promise<T[]>;
  one: <T extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => Promise<T | undefined>;
  tx: <T>(fn: (client: PoolClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
};

export function createDb(databaseUrl = loadConfig().databaseUrl): Db {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    pool,
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
      const result = await pool.query<T>(sql, values);
      return result.rows;
    },
    async one<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
      const result = await pool.query<T>(sql, values);
      return result.rows[0] as T | undefined;
    },
    async tx<T>(fn: (client: PoolClient) => Promise<T>) {
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
    },
    close() {
      return pool.end();
    },
  };
}

export async function runCoreMigration(db: Db): Promise<void> {
  const sql = await readFile(migrationPath, "utf8");
  await db.pool.query(sql);
}
