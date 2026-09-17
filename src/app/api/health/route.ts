import { jsonFail, jsonOk } from "@/lib/http";

export async function GET() {
  try {
    if (!process.env.DATABASE_URL) {
      return jsonFail("DATABASE_URL ausente", 503);
    }
    return jsonOk({ ok: true, name: "Lousa" });
  } catch (error) {
    return jsonFail(error instanceof Error ? error.message : "falha", 500);
  }
}
