## Context

`/` shows the shared todo list from the archived `add-todo-list` change. Todos live in an in-memory `Map` on `globalThis.__todoListStore` (`lib/todos/store.ts`). The proposal adds a bar chart above the list with one bar per day for the last 14 days: today and the 13 previous days. The user decided four things:

- the chart goes on `/`, above the list;
- days follow the viewer's local time;
- every completion is recorded, and unchecking or deleting a todo never lowers a past count;
- the chart uses a library (TanStack Charts, chosen in review).

Requirements are in `specs/completion-stats/spec.md`.

Constraints:

- Next.js 16.4.2 App Router, React 19.3, Tailwind v4, TypeScript, pnpm. There is no test tooling, and this change adds none.
- `next.config.ts` enables `cacheComponents: true` and `partialPrefetching: true`. A GET Route Handler that touches no request data can be prerendered at build time, so `GET /api/todos` already calls `await connection()`.
- `Todo` is `{ id, title, completed, createdAt }`. Nothing records when a todo was completed. `updateTodo` overwrites `completed` without looking at the previous value.
- `app/todo-list.tsx` is a client component that owns its own todos state. The checkbox calls `onUpdate(id, { completed: !todo.completed })`, and the UI changes only after the server confirms.
- The repo has no `adr/` folder, so no in-force ADRs constrain this design.

## Goals / Non-Goals

**Goals:**

- Record each incomplete-to-complete change of a todo as a timestamped event that later edits cannot remove.
- Expose those events through a small JSON endpoint that follows the conventions of `/api/todos`.
- Show 14 daily counts on `/`, grouped by the viewer's local calendar date, oldest on the left.
- Refresh the chart after the user checks or unchecks a todo, without a page reload.
- Keep `pnpm build` green under Cache Components, with no hydration warnings on `/`.

**Non-Goals:**

- Persistence across restarts, or a shared log across several server instances.
- Per-user statistics. The log is global, like the todo list.
- A configurable range, other chart types, or totals beyond the 14 bars.
- Timezone handling on the server.
- Moving the bars forward when local midnight passes while the page stays open.
- Backfilling events for todos completed before this change ships.
- Automated tests.

## Decisions

### 1. Append-only completion log in the store, recorded inside `updateTodo`

`lib/todos/store.ts` gains a second collection, an array of events:

```ts
type CompletionEvent = { todoId: string; completedAt: string /* ISO 8601 */ };
```

The array lives on `globalThis` under its own namespaced key and is created only when missing, the same pattern the todo `Map` uses. It has the same lifetime: one log per Node process, shared by every client, lost on restart. Events are appended in time order, so the array is always oldest first. The store exports a read function that returns copies of the events with `completedAt >= since`.

Recording rule: `updateTodo` appends an event only when `existing.completed === false` and the resulting todo has `completed === true`. It appends nothing in these cases:

- a PATCH with `completed: true` on a todo that is already complete;
- a title-only PATCH;
- unchecking a todo.

Unchecking and deleting never remove events. Completing a todo again after unchecking it appends a new event [assumption: derived from "every completion is recorded"; see Open Questions]. `createTodo` always creates an incomplete todo, so creation never records anything.

Rationale: `updateTodo` is the only place where `completed` changes and the only place that sees both the old and the new value, so the rule sits there and both route files stay untouched. An append-only log matches the user's answer directly: past counts depend only on events that already happened.

Alternatives considered:

- A `completedAt` field on `Todo`, cleared on uncheck. Unchecking or deleting a todo would erase its history, which the user explicitly did not want. It would also allow only one completion per todo. Rejected.
- Recording the event in the PATCH route handler. That puts a domain rule in the transport layer, and the handler would need to read the old value first. Rejected.

### 2. `GET /api/completions?since=` with `await connection()`

New file `app/api/completions/route.ts` with a single `GET`. It parses `since`, calls `await connection()` from `next/server`, reads the log through the store and returns JSON. Errors reuse `errorResponse` from `lib/todos/http.ts`. The handler compares instants, not strings: `since` may carry any UTC offset, so it is parsed into a `Date` before the comparison.

| Method | Path | Query | Success | Errors |
|---|---|---|---|---|
| GET | `/api/completions` | `since`: ISO 8601 instant, required | 200, `{ "todoId": string, "completedAt": string }[]`, oldest first, only events with `completedAt >= since` | 400 `{ "error": string }` if `since` is missing or not a valid date |

The `/api/todos` contracts do not change.

Rationale: the client needs raw events to group them by its own local days (Decision 3), and `since` keeps the response limited to the range on screen. `await connection()` stops the build from prerendering the handler with an empty log, for the same reason as in `GET /api/todos`.

Alternatives considered:

- `/api/todos/completions`. It sits next to the dynamic `[id]` segment, so the route tree and anyone reading it must tell a literal `completions` apart from a todo id. Events also outlive the todos they point to. Rejected in favour of a top-level `/api/completions`.
- Returning the whole log with no filter. Simpler, but the response grows with every completion for the life of the process. Rejected.

### 3. Grouping into local days on the client

The browser computes `since` as local midnight 13 days before today and sends it as an ISO instant. It then builds 14 day keys from today's local date, stepping back one calendar day at a time with `Date` setters rather than subtracting 24 hours, so DST changes do not shift a day. Each event goes into the bucket for its local calendar date. Days with no events get 0. The result is exactly 14 entries, oldest first, today last.

Rationale: the browser already knows the viewer's timezone, and the server stays timezone-free. The API returns plain instants and stays reusable for other ranges.

Alternatives considered:

- The server groups events and takes a `tz` parameter (IANA name or offset). It needs IANA timezone and DST handling on the server, and the contract grows a parameter, its validation and a new 400 case. Rejected.
- The server groups by UTC days. Wrong for any viewer outside UTC, and it contradicts the user's answer. Rejected.

### 4. TanStack Charts `Chart` in a client-only component

New file `app/completion-chart.tsx` (`"use client"`). It builds the chart with `defineChart` from `@tanstack/charts`:

- one `barY(rows, { x: 'day', y: 'count' })` mark over the 14 grouped days;
- a band x scale (`scaleBand` from `@tanstack/charts/scales/band`, with padding), labelled with the short weekday and day of month in the viewer's locale (for example "Mon 19") [assumption];
- a linear y scale (`scaleLinear` from `@tanstack/charts/scales/linear`) with `nice: true`, grid lines and a tick `format` or tick count that shows whole numbers only. A dedicated integer-ticks option was not found in the docs checked so far [assumption: verify the exact option at apply];
- a `tooltip` from `@tanstack/charts/tooltip` that shows the count.

It renders the definition with `<Chart>` from `@tanstack/charts/react`, passing `height`, `initialWidth` and `ariaLabel` and no `width`. Without `width` the chart observes its container and resizes with it. `initialWidth` makes the server output deterministic, though here it mostly affects the first paint, because the chart renders only after its data loads (Decision 6). The heading reads "Completed in the last 14 days" [assumption].

Dependency: `pnpm add @tanstack/charts`. React and React DOM 18 or 19 are optional peers and are already installed. The exact version is chosen at apply time [needs update at apply].

Rationale: the user chose TanStack Charts. One package covers bars, scales, axes and a tooltip without custom drawing code. Chart definitions are framework-agnostic, and the library supports server rendering; its React adapter uses `useEffect` during SSR.

Alternatives considered:

- Recharts. The earlier pick in this design; the user replaced it with TanStack Charts during review.
- A hand-rolled SVG or CSS bar chart. No new dependency and a smaller bundle, but the user asked for a library. Rejected.

Adopting TanStack Charts as the project's charting library is the one durable decision in this change. The ADR step records it as the project's first ADR.

### 5. Refresh through a client wrapper with a `reloadKey`

New file `app/home-dashboard.tsx` (`"use client"`) owns a `reloadKey` counter. It renders `<CompletionChart reloadKey={reloadKey} />` above `<TodoList onCompletionChange={...} />`. `TodoList` calls `onCompletionChange` after a successful PATCH that changed `completed`, in either direction. The wrapper increments `reloadKey`, and the chart refetches whenever `reloadKey` changes. `app/page.tsx` renders `<HomeDashboard />` instead of `<TodoList />` and stays a Server Component.

Rationale: `TodoList` gains one optional callback prop and the chart gains one prop. Nothing else in the list changes. Refetching on uncheck too costs one extra request, and it keeps the trigger simple.

Alternatives considered:

- The chart polls `/api/completions` on an interval. Laggy, and it sends requests while nothing changes. Rejected.
- Lift the todos state from `TodoList` into the wrapper and derive the trigger from it. That moves fetching and every mutation handler out of `todo-list.tsx`, which is a lot of churn for a refresh signal. Rejected.
- Count completions on the client from the todos state. It cannot see past events or other clients' completions. Rejected.

### 6. Fetch and group in `useEffect`, with a loading placeholder

The chart reads the clock, fetches and groups only inside `useEffect`. It never calls `new Date()` during render. Until the data arrives it renders a placeholder of the same height. If the request fails, it shows an inline error message in place of the chart, and the todo list stays usable. This follows the `isLoaded` pattern already in `todo-list.tsx`.

Rationale: under Cache Components the client component's shell is prerendered. A date or locale computed during render would differ between the server and the browser and cause a hydration mismatch. Keeping all time-dependent work in an effect makes the first client render match the server output.

Alternatives considered:

- `next/dynamic` with `ssr: false`. It also avoids the mismatch, but adds a second loading mechanism next to the one the list already uses. Rejected.
- Render the chart on the server. The server does not know the viewer's timezone (Decision 3), and the data changes on every completion. Rejected.

## Risks / Trade-offs

- [Hydration mismatch from dates or locale formatting computed during render] -> All time-dependent work runs in `useEffect`, and the first render is a fixed placeholder (Decision 6). Checked by loading `/` in `pnpm dev` with no hydration warnings in the console.
- [Double counting when the same todo is completed repeatedly] -> A PATCH that does not move `completed` from false to true records nothing, so repeated `completed: true` requests and title edits are ignored. Uncheck followed by check counts again by design [assumption]; see Open Questions.
- [The page stays open past local midnight, so the bars no longer end at today] -> Accepted, listed as a non-goal. A reload or the next completion change refetches and rebuilds the 14 days from the current date.
- [TanStack Charts adds client JavaScript to `/`] -> Accepted. The size is unmeasured [unconfirmed]; compare the build output for `/` before and after at apply time.
- [No confirmed option for whole-number y ticks] -> Use a tick `format` or tick count that yields integers only, and check at apply time that counts of 0 to 3 produce no fractional ticks [assumption: verify the exact option at apply].
- [The in-memory log grows without bound] -> Accepted. One small object per completion for the life of the process; it resets on restart, like the todos.
- [The `@tanstack/charts` version is not pinned in this design] -> Chosen at apply time and recorded in task 1.3. The library is young, so its API may differ from the docs used here [needs update at apply].
- [`GET /api/completions` prerendered at build time with an empty log] -> `await connection()` (Decision 2). Checked by `pnpm build` listing `/api/completions` as dynamic.

## Migration Plan

- Install the dependency: `pnpm add @tanstack/charts`.
- No data migration. Todos completed before the change have no events, and the store starts empty on every restart anyway.
- Rollback: revert the commit and remove `@tanstack/charts`. No data or external systems are involved.

## Open Questions

- Should completing a todo again after unchecking it count again? The design says yes, following "every completion is recorded", so a todo toggled twice in one day adds 2 to that day. If the user wants one count per todo per day, only the store's recording rule changes.
- The ADR step records the adoption of TanStack Charts as the project's first ADR. No other ADRs are in force.
- Which `@tanstack/charts` option gives whole-number y ticks? To be confirmed against the docs of the installed version at apply time.
- Assumptions that still stand: the X-axis label format ("Mon 19") and the heading text "Completed in the last 14 days".
