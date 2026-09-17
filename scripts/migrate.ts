import { resolve } from "node:path";
import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL ausente");
    process.exit(1);
  }

  const sql = postgres(url, {
    max: 1,
    ssl: process.env.DATABASE_SSL === "false" ? false : "require",
  });

  await sql.file(resolve("db/init.sql"));
  await sql.end();
  console.log("Lousa: schema aplicado.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
