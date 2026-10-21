## 1. Dependencies

- [x] 1.1 Before writing code, read the relevant guides in `node_modules/next/dist/docs/` (this Next.js version has breaking changes): Route Handlers, `connection()` from `next/server`, and Cache Components behaviour for GET handlers and client components. Also read the TanStack Charts React quick start and the band scale, linear scale and tooltip docs.
- [x] 1.2 Run `pnpm build` on the current code and note the size of `/` in the output, as the baseline for 6.1. Baseline: Next.js 16.4.2 no longer prints route sizes, so measured the JS chunks referenced by `.next/server/app/index.html`: 7 chunks, 574,822 B raw, 176,724 B gzip.
- [x] 1.3 Run `pnpm add @tanstack/charts`. Check that `package.json` lists `@tanstack/charts`, and record the installed version in this task. Installed: `@tanstack/charts` 1.1.0 (`^1.1.0` in `package.json`).

## 2. Completion log in the store

- [x] 2.1 In `lib/todos/store.ts`, export the type `CompletionEvent = { todoId: string; completedAt: string }`, with `completedAt` as an ISO 8601 timestamp.
- [x] 2.2 In `lib/todos/store.ts`, keep the completion events in an array on `globalThis` under its own namespaced key, created only if missing, the same way as the todo `Map`.
- [x] 2.3 In `updateTodo` in `lib/todos/store.ts`, append `{ todoId, completedAt: new Date().toISOString() }` only when the existing todo has `completed: false` and the updated one has `completed: true`. Append nothing for a PATCH on an already completed todo, a title-only PATCH or an uncheck. Unchecking and `deleteTodo` never remove events.
- [x] 2.4 In `lib/todos/store.ts`, export a read function that takes a `since` `Date` and returns copies of the events with `completedAt >= since`, oldest first. Compare instants (`Date` values), not strings. Done when `pnpm exec tsc --noEmit` passes.

## 3. Completions API

- [x] 3.1 Create `app/api/completions/route.ts` with `GET`. It reads `since` from the query string, returns 400 through `errorResponse` from `lib/todos/http.ts` when `since` is missing or does not parse to a valid date, calls `await connection()` from `next/server`, and returns 200 with the events from the store's read function.
- [x] 3.2 With `pnpm dev` running, complete a todo with `curl -X PATCH` and check with `curl` that `GET /api/completions?since=<that event's completedAt>` returns the event (the `>=` boundary) and that a `since` one second later returns `[]`.
- [x] 3.3 With `curl`, check that `GET /api/completions` without `since` and `GET /api/completions?since=yesterday` both return 400 with a string `error`.
- [x] 3.4 With `curl`, check that a PATCH with `{"completed": true}` on an already completed todo and a title-only PATCH add no event, and that after `DELETE /api/todos/{id}` the todo's event is still returned.

## 4. Chart component

- [x] 4.1 Create `app/completion-chart.tsx` with `"use client"` and a `reloadKey: number` prop. Until data loads, render a placeholder with the chart's fixed height. Never call `new Date()` or format dates during render.
- [x] 4.2 In a `useEffect` that depends on `reloadKey`, compute `since` as local midnight 13 days before today, fetch `GET /api/completions?since=<since as ISO>`, and store the result.
- [x] 4.3 In the same effect, build 14 local days, oldest first and today last, by stepping one calendar day at a time with `Date` setters (not by subtracting 24 hours, so DST does not shift a day). Count each event into the bucket of its local calendar date and give days with no events 0.
- [x] 4.4 When the request fails or returns a non-OK status, show an inline error message in place of the chart.
- [x] 4.5 Render the heading "Completed in the last 14 days" and a TanStack Charts `Chart` from `@tanstack/charts/react`. Build its definition with `defineChart`: a `barY` mark over the 14 days, a band x scale labelled with the short weekday and day of month in the viewer's locale (for example "Mon 19"), a linear y scale whose ticks show whole numbers only, and a `tooltip` that shows the count. Pass `height`, `initialWidth` and an `ariaLabel`, and no fixed `width`.

## 5. Wiring on the home page

- [x] 5.1 In `app/todo-list.tsx`, add an optional `onCompletionChange` prop and call it after a successful PATCH that changed `completed`, in either direction. Title edits and failed requests do not call it.
- [x] 5.2 Create `app/home-dashboard.tsx` with `"use client"`. It holds a `reloadKey` counter in state and renders `<CompletionChart reloadKey={reloadKey} />` above `<TodoList onCompletionChange={...} />`, where the callback increments `reloadKey`.
- [x] 5.3 Change `app/page.tsx` to render `<HomeDashboard />` instead of `<TodoList />`. It stays a Server Component, with no `"use client"`.

## 6. Verification

- [x] 6.1 Run `pnpm build`. It passes with no prerender or Cache Components errors, the output lists `/api/completions` as dynamic, and the size of `/` is noted next to the baseline from 1.2. After: 7 chunks, 691,695 B raw, 217,129 B gzip (baseline 574,822 / 176,724; +116,873 B raw, +40,405 B gzip).
- [x] 6.2 Run `pnpm dev` and manually check every scenario in `specs/completion-stats/spec.md`. Cover the UTC+3 scenario with a timezone override in the browser devtools, the second-browser scenario, all zeros after restarting the dev server, and a failed completions request (for example, blocked in devtools) that shows the inline error while the list still works.
- [x] 6.3 While checking 6.2, confirm the browser console shows no hydration warnings on `/`.
- [x] 6.4 Run `openspec validate add-completion-stats-chart --type change --strict` and fix any reported issues.
