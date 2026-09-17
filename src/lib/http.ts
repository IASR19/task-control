export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonOk(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function jsonFail(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof HttpError) {
    return jsonFail(error.message, error.status);
  }
  const message = error instanceof Error ? error.message : "Falha inesperada";
  if (message.includes("DATABASE_URL")) {
    return jsonFail("Banco não configurado. Defina DATABASE_URL no ambiente.", 503);
  }
  console.error(error);
  return jsonFail("Falha inesperada", 500);
}
