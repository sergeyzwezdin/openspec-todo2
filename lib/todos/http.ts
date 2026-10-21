import type { TodoError } from "@/lib/todos/store";

/** Outcome of reading a JSON request body. */
export type JsonBodyResult = { ok: true; body: unknown } | { ok: false };

/** HTTP status for each store error. */
const statusByTodoError: Record<TodoError, number> = {
  "invalid-title": 400,
  "not-found": 404,
};

/** Message returned to the client for each store error. */
const messageByTodoError: Record<TodoError, string> = {
  "invalid-title": "Title must not be empty.",
  "not-found": "Todo not found.",
};

/** Parses the request body as JSON; an empty or malformed body is reported as not ok. */
export const readJsonBody = async (request: Request): Promise<JsonBodyResult> => {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
};

/** JSON error response with the `{ "error": string }` body shared by all todo endpoints. */
export const errorResponse = (status: number, message: string): Response =>
  Response.json({ error: message }, { status });

/** Maps a store error to its 400 or 404 response. */
export const todoErrorResponse = (error: TodoError): Response =>
  errorResponse(statusByTodoError[error], messageByTodoError[error]);

/** True for a plain JSON object, excluding `null` and arrays. */
export const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
