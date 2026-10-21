import type { NextRequest } from "next/server";
import { errorResponse, isJsonObject, readJsonBody, todoErrorResponse } from "@/lib/todos/http";
import { deleteTodo, updateTodo, type TodoChanges } from "@/lib/todos/store";

/** Outcome of validating a PATCH body. */
type ChangesResult = { ok: true; changes: TodoChanges } | { ok: false; message: string };

/** Updates `title` and/or `completed`; the body is validated before the id is looked up. */
export const PATCH = async (
  request: NextRequest,
  ctx: RouteContext<"/api/todos/[id]">,
): Promise<Response> => {
  const { id } = await ctx.params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return errorResponse(400, "Request body must be valid JSON.");

  const validated = parseChanges(parsed.body);
  if (!validated.ok) return errorResponse(400, validated.message);

  const result = updateTodo(id, validated.changes);
  if (!result.ok) return todoErrorResponse(result.error);
  return Response.json(result.value);
};

/** Deletes a todo and returns 204 with an empty body. */
export const DELETE = async (
  _request: NextRequest,
  ctx: RouteContext<"/api/todos/[id]">,
): Promise<Response> => {
  const { id } = await ctx.params;
  const result = deleteTodo(id);
  if (!result.ok) return todoErrorResponse(result.error);
  return new Response(null, { status: 204 });
};

/** Checks field types and that at least one of `title` or `completed` is present. */
const parseChanges = (body: unknown): ChangesResult => {
  if (!isJsonObject(body)) return { ok: false, message: "Request body must be a JSON object." };

  const { title, completed } = body;
  if (title !== undefined && typeof title !== "string") {
    return { ok: false, message: "Field \"title\" must be a string." };
  }
  if (completed !== undefined && typeof completed !== "boolean") {
    return { ok: false, message: "Field \"completed\" must be a boolean." };
  }
  if (title === undefined && completed === undefined) {
    return { ok: false, message: "Provide \"title\" or \"completed\"." };
  }
  return { ok: true, changes: { title, completed } };
};
