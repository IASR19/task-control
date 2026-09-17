import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForSql = globalThis as unknown as {
  lousaSql?: ReturnType<typeof postgres>;
};

function sslOption() {
  if (process.env.DATABASE_SSL === "false") return false;
  return "require" as const;
}

export function sqlClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL ausente");
  }
  if (!globalForSql.lousaSql) {
    globalForSql.lousaSql = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 15,
      ssl: sslOption(),
      prepare: false,
    });
  }
  return globalForSql.lousaSql;
}

export function db() {
  return drizzle(sqlClient(), { schema });
}
