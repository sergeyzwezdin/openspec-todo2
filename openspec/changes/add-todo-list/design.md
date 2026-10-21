## Context

`/` currently renders the create-next-app scaffold (`app/page.tsx`). The proposal replaces it with a todo list. The user chose server-side storage: "server side, nextjs bff, in-memory". Requirements are in `specs/todo-list/spec.md`.

Constraints:

- Next.js 16.4.2 App Router, React 19.3, Tailwind v4, TypeScript, pnpm. The project has no other runtime dependencies and no test tooling. This change adds neither.
- `next.config.ts` enables `cacheComponents: true` and `partialPrefetching: true`. Under Cache Components, a GET Route Handler that reads no runtime or uncached data can be prerendered at build time. Next cannot tell that a module-level array is uncached.
- A `route.ts` cannot sit in the same segment as `page.tsx`, so the API goes under `app/api/`.
- Dynamic route params are a Promise in this version: `ctx: RouteContext<'/api/todos/[id]'>`, then `const { id } = await ctx.params`.
- `openspec/specs/` is empty and the repo has no `adr/` folder, so no earlier decisions constrain this design.

## Goals / Non-Goals

**Goals:**

- Replace the scaffold at `/` with a todo list that supports add, inline edit, remove, complete and uncomplete.
- Keep todos on the server, in memory, behind a small JSON API owned by the Next.js app (the BFF).
- Make every client see the same list for as long as the server process runs.
- Keep `pnpm build` green with Cache Components enabled.

**Non-Goals:**

- Persistence across server restarts, or consistency across several server instances or serverless invocations.
- Authentication, per-user lists, multi-tenant isolation.
- Filtering, reordering, due dates, bulk actions.
- A maximum title length.
- Automated tests. The specs are documentation only.
- Changes to `app/layout.tsx` metadata or removal of unused files in `public/`.

## Decisions

### 1. BFF as Route Handlers with a REST JSON API

[assumption: Route Handlers, not Server Actions. "BFF" is read as an HTTP API.]

Two files:

- `app/api/todos/route.ts`: `GET` (list) and `POST` (create).
- `app/api/todos/[id]/route.ts`: `PATCH` (update `title` and/or `completed`) and `DELETE`.

Rationale: an explicit HTTP contract matches the user's word "BFF". It can be exercised with `curl` during manual checks, and the 400/404 behaviour in the spec maps directly onto status codes.

Alternatives considered:

- Server Actions called from the client component. Less code (no fetch or JSON parsing, built-in revalidation), but there is no HTTP API to call or check by hand, and the 404/400 contract would turn into thrown errors or return values. Rejected because of how we read "BFF". If the user meant Server Actions, only the transport layer changes; the store and UI stay the same.

API contract (all bodies JSON; error body is `{ "error": string }` [assumption]):

| Method | Path | Request body | Success | Errors |
|---|---|---|---|---|
| GET | `/api/todos` | none | 200, `Todo[]` oldest first | none |
| POST | `/api/todos` | `{ "title": string }` | 201, created `Todo` | 400 if `title` is missing, not a string, or empty after trim |
| PATCH | `/api/todos/{id}` | `{ "title"?: string, "completed"?: boolean }`, at least one field | 200, updated `Todo` | 400 if `title` is empty after trim, a field has the wrong type, or neither field is present; 404 if `id` is unknown |
| DELETE | `/api/todos/{id}` | none | 204, empty body | 404 if `id` is unknown |

Invalid JSON in a request body returns 400 [assumption].

### 2. In-memory store on a `globalThis` singleton

`lib/todos/store.ts` owns the data and exports plain functions (`listTodos`, `createTodo`, `updateTodo`, `deleteTodo`) used by both route files. The same file exports the `Todo` type:

```ts
type Todo = { id: string; title: string; completed: boolean; createdAt: string };
```

`id` comes from `crypto.randomUUID()`. `createdAt` is an ISO 8601 string. The store keeps todos in insertion order, so lists come back oldest first [assumption]. Title trimming and the empty check happen in the store so both create and update share one rule. Route handlers turn store results into status codes.

The backing collection is stored on `globalThis` under a namespaced key and created only if it is missing.

Rationale: in `next dev`, HMR re-evaluates modules, and different route bundles can get separate module instances. A plain module variable would then reset or split, and todos would vanish between requests. A `globalThis` slot gives one store per Node process.

Alternatives considered:

- Plain module-level variable. Simplest, but it resets on HMR and can split across route bundles in dev. Rejected.
- File (JSON on disk) or a database such as SQLite. Survives restarts, but the user asked for in-memory, and it adds I/O, a dependency or a deployment concern. Rejected for this change.

### 3. Client component fetches the list. The page does not render it on the server.

`app/page.tsx` becomes a thin Server Component that renders `app/todo-list.tsx` (`"use client"`). On mount, the component fetches `GET /api/todos`. For each mutation it calls the API and updates local state from the response body: it appends the created todo, replaces the updated one, or removes the deleted id. The UI changes only after the server confirms (no optimistic updates). That keeps the 400/404 handling simple. Failed requests leave the list unchanged and show an inline error message.

UI behaviour: an input plus submit button to add; click a title or an Edit button to enter edit mode, Enter or Save to save, Escape to cancel and restore the original; a Delete button with no confirmation; a checkbox to toggle `completed`, with completed titles shown in strikethrough; an empty-state message when the list is empty. The client also skips the request when the trimmed title is empty, so the UI matches the API rule.

Rationale: the list changes on every request, and the user's actions mutate it. Under `cacheComponents`, reading the store in a Server Component would need `connection()` or a `<Suspense>` boundary plus cache invalidation after each mutation. A client-owned list avoids all of that and uses the same API that defines the contract.

Alternatives considered:

- Server Component reads the store directly and Server Actions mutate it and revalidate the page. Gives a first paint with data, but couples the UI to Cache Components and Partial Prefetching semantics and skips the HTTP API. Rejected.
- Server Component fetches its own `/api/todos`. An extra network hop within the same process, with the same caching concerns. Rejected.

### 4. `await connection()` in the GET handler

`GET /api/todos` calls `await connection()` from `next/server` before it reads the store.

Rationale: with Cache Components on, a GET handler that touches no request data can be prerendered at build time. The in-memory array is not detected as uncached, so without `connection()` the build would freeze an empty list into a static response. `POST`, `PATCH` and `DELETE` are never cached, so they need nothing extra. `[id]/route.ts` has no GET.

Alternatives considered:

- Reading a request API such as `headers()` only to opt out. Works, but hides the intent. Rejected.
- Route segment config `export const dynamic = 'force-dynamic'`. Not available: the bundled route segment config docs say `dynamic` was removed when Cache Components is enabled (v16.0.0).

## Risks / Trade-offs

- [Todos are lost when the server restarts or redeploys] -> Accepted by the user. Documented in the proposal and in the spec requirement "Todos persist for the server process lifetime".
- [Several server instances or serverless invocations each hold their own list, so clients see different or empty data] -> Accepted. Run a single long-lived Node process (`pnpm dev` or `pnpm start`). Real persistence is a later change.
- [One shared list with no auth: any visitor can read and change every todo] -> Accepted for this scope. Auth and per-user lists are non-goals.
- [Concurrent edits from two browsers: last write wins, and other clients see changes only after a reload] -> Accepted. There is no live sync. The spec only requires visibility after a page load.
- [GET prerendered at build time, which would serve a stale empty list] -> `await connection()` in the GET handler. Verified by `pnpm build` finishing without prerender errors and by `/api/todos` being listed as dynamic.
- [Unbounded memory growth from many or very long titles] -> Accepted. There is no max length and no limit on the number of todos. Fine for a single user on a local server.
- [Store state resetting during dev HMR] -> `globalThis` singleton (Decision 2).

## Migration Plan

- No data migration: there is no existing data, and the store starts empty on every process start.
- Deploy by merging the change. The scaffold home page is removed in the same change (the BREAKING item in the proposal).
- Rollback: revert the commit. Nothing else needs undoing, because no data or external systems are involved.

## Open Questions

- No in-force ADRs exist (the repo has no `adr/` folder), so none need revisiting.
- Assumptions that still stand (recorded above and in the spec; change them if the user disagrees):
  - Route Handlers rather than Server Actions as the BFF.
  - Todos ordered by creation, oldest first.
  - Titles trimmed; empty or whitespace-only titles rejected with 400.
  - No confirmation dialog on delete.
  - Error body shape `{ "error": string }`; invalid JSON returns 400.
