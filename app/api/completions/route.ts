import { connection, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/todos/http";
import { listCompletionsSince } from "@/lib/todos/store";

/** Lists completion events at or after the `since` query parameter, oldest first. */
export const GET = async (request: NextRequest): Promise<Response> => {
  const since = readSince(request);
  if (since === undefined) return errorResponse(400, "Query parameter \"since\" must be a valid date.");

  // The in-memory store is not detected as uncached, so opt out of build-time prerendering.
  await connection();
  return Response.json(listCompletionsSince(since));
};

/** The `since` query parameter as a `Date`, or `undefined` when it is missing or not a valid date. */
const readSince = (request: NextRequest): Date | undefined => {
  const value = request.nextUrl.searchParams.get("since");
  if (value === null) return undefined;

  const since = new Date(value);
  return Number.isNaN(since.getTime()) ? undefined : since;
};
