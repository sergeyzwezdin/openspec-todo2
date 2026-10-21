## 1. Data model and in-memory store

- [ ] 1.1 Before writing code, read the relevant guides in `node_modules/next/dist/docs/` (this Next.js version has breaking changes): Route Handlers (`route.ts`, `RouteContext`, async `params`), `connection()` from `next/server`, and Cache Components behaviour for GET handlers.
- [ ] 1.2 Create `lib/todos/store.ts` and export the `Todo` type `{ id: string; title: string; completed: boolean; createdAt: string }`.
- [ ] 1.3 In `lib/todos/store.ts`, keep the todo collection on a `globalThis` singleton under a namespaced key, created only if missing, so it survives dev HMR and separate module instances.
- [ ] 1.4 In `lib/todos/store.ts`, implement `listTodos` (creation order, oldest first), `createTodo(title)` (trim, reject empty, `crypto.randomUUID()` id, `completed: false`, ISO `createdAt`), `updateTodo(id, { title?, completed? })` (trim and reject empty title, report unknown id) and `deleteTodo(id)` (report unknown id). Done when `pnpm exec tsc --noEmit` passes.

## 2. API route handlers

- [ ] 2.1 Create `app/api/todos/route.ts` with `GET`. It calls `await connection()` from `next/server` before reading the store and returns 200 with the `Todo[]` from `listTodos`.
- [ ] 2.2 Add `POST` to `app/api/todos/route.ts`. It parses the JSON body, returns 400 with `{ "error": string }` for invalid JSON or a missing, non-string or empty-after-trim `title`, and otherwise returns 201 with the created todo.
- [ ] 2.3 Create `app/api/todos/[id]/route.ts` with `PATCH`. It reads `id` via `ctx: RouteContext<'/api/todos/[id]'>` and `await ctx.params`, returns 400 for invalid JSON, wrong field types, an empty-after-trim `title` or a body with neither `title` nor `completed`, returns 404 for an unknown id, and otherwise returns 200 with the updated todo.
- [ ] 2.4 Add `DELETE` to `app/api/todos/[id]/route.ts`. It returns 204 with an empty body on success and 404 for an unknown id.
- [ ] 2.5 With `pnpm dev` running, check each row of the API contract table in `design.md` with `curl` (201, 200, 204, 400, 404).

## 3. Todo list UI client component

- [ ] 3.1 Create `app/todo-list.tsx` with `"use client"`. It fetches `GET /api/todos` on mount, holds the todos in local state and renders them in order.
- [ ] 3.2 In `app/todo-list.tsx`, render an empty-state message when the list is empty.
- [ ] 3.3 In `app/todo-list.tsx`, add a new-todo input and submit button. Skip the request when the trimmed title is empty. On 201, append the returned todo and clear the input.
- [ ] 3.4 In `app/todo-list.tsx`, add inline title editing. Entering edit mode shows an input prefilled with the title. Enter or Save sends `PATCH` with the trimmed title and replaces the todo from the response. Escape exits edit mode and restores the original title. An empty title is not saved and the todo keeps its title.
- [ ] 3.5 In `app/todo-list.tsx`, add a checkbox per todo that sends `PATCH` with the toggled `completed` value and replaces the todo from the response. Completed titles render with strikethrough (`line-through`).
- [ ] 3.6 In `app/todo-list.tsx`, add a Delete button per todo that sends `DELETE` with no confirmation and removes the todo from local state on 204.
- [ ] 3.7 In `app/todo-list.tsx`, handle failed requests (network error, 400, 404, failed initial load): leave the list unchanged and show an inline error message.

## 4. Replace home page

- [ ] 4.1 Rewrite `app/page.tsx` to render `<TodoList />` from `app/todo-list.tsx` and remove all scaffold content (Next.js logo `Image`, "To get started" heading, Templates, Learning, Deploy Now and Documentation links).

## 5. Verification

- [ ] 5.1 Run `pnpm build`. It passes with no prerender or Cache Components errors, and the build output lists `/api/todos` as dynamic, not prerendered.
- [ ] 5.2 Run `pnpm dev` and manually check every scenario in `specs/todo-list/spec.md`, including reload, a second browser, and the empty list after restarting the dev server.
- [ ] 5.3 Run `openspec validate add-todo-list --type change --strict` and fix any reported issues.
