import { connection, type NextRequest } from "next/server";
import { errorResponse, isJsonObject, readJsonBody, todoErrorResponse } from "@/lib/todos/http";
import { createTodo, listTodos } from "@/lib/todos/store";

/** Lists all todos, oldest first. */
export const GET = async (): Promise<Response> => {
  // The in-memory store is not detected as uncached, so opt out of build-time prerendering.
  await connection();
  return Response.json(listTodos());
};

/** Creates a todo from `{ "title": string }` and returns it with 201. */
export const POST = async (request: NextRequest): Promise<Response> => {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return errorResponse(400, "Request body must be valid JSON.");

  const title = readTitle(parsed.body);
  if (title === undefined) return errorResponse(400, "Field \"title\" must be a string.");

  const result = createTodo(title);
  if (!result.ok) return todoErrorResponse(result.error);
  return Response.json(result.value, { status: 201 });
};

/** The `title` field of a JSON object body, or `undefined` when the body or field has the wrong shape. */
const readTitle = (body: unknown): string | undefined => {
  if (!isJsonObject(body)) return undefined;
  return typeof body.title === "string" ? body.title : undefined;
};
