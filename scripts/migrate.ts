import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const MIGRATIONS_DIR = resolve("db/migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL ausente");
    process.exit(1);
  }

  const sql = postgres(url, {
    max: 1,
    ssl: process.env.DATABASE_SSL === "false" ? false : "require",
    onnotice: () => {},
  });

  // Base idempotente (IF NOT EXISTS): deixa um banco novo pronto antes das migrations.
  await sql.file(resolve("db/init.sql"));
  console.log("Lousa: schema base aplicado.");

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map((row) => row.name),
  );

  const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();
  const pending = files.filter((file) => !applied.has(file));

  for (const file of pending) {
    const body = await readFile(resolve(MIGRATIONS_DIR, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (name) VALUES (${file})`;
    });
    console.log(`Lousa: migration ${file} aplicada.`);
  }

  if (!pending.length) console.log("Lousa: nenhuma migration pendente.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
