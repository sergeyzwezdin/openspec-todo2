## Why

Users can complete todos, but nothing shows how many they finish over time. The user first asked to "show statistics of completed tasks as a chart day-by-day for last 7 days", then widened the range to 14 days.

## What Changes

- The server keeps an append-only log of completion events (`todoId`, `completedAt`). It adds an event each time a todo goes from incomplete to complete. Unchecking or deleting a todo never removes events, so past counts never go down.
- Completing a todo again after unchecking it adds a new event, so a todo toggled twice in one day counts twice [assumption: derived from "every completion is recorded"].
- New endpoint `GET /api/completions?since=<ISO 8601 instant>` returns events with `completedAt >= since`, oldest first. A missing or invalid `since` returns 400 with `{ "error": string }`.
- The home page `/` shows a TanStack Charts bar chart above the todo list. It has exactly 14 bars: today and the 13 previous days, oldest on the left. Days without completions show 0.
- Days follow the viewer's local time. The browser computes the start of the range (local midnight 13 days ago) and groups events by its own calendar date.
- The chart refetches without a page reload after the user checks or unchecks a todo.
- If the chart fails to load, it shows an inline error and the todo list keeps working.

Out of scope: persistence across restarts, per-user stats, a configurable range, server-side timezone handling, updating the days when midnight passes while the page stays open, backfilling completions made before this change, and automated tests.

## Capabilities

### New Capabilities

- `completion-stats`: The 14-day completion chart on the home screen. Covers recording completion events, the `GET /api/completions` API, grouping events into local-time days and refreshing the chart after a todo is checked or unchecked.

### Modified Capabilities

None.

## Impact

- `lib/todos/store.ts`: gains the completion log; `updateTodo` records an event on each incomplete-to-complete change.
- New `app/api/completions/route.ts`: the `GET /api/completions` handler.
- New `app/completion-chart.tsx`: client component that fetches events and draws the chart.
- New `app/home-dashboard.tsx`: client wrapper that renders the chart above the list and triggers chart refetches.
- `app/todo-list.tsx`: notifies the wrapper after a successful change to a todo's `completed` state.
- `app/page.tsx`: renders the wrapper instead of `<TodoList />`.
- New dependency: `@tanstack/charts`. No other packages are needed. The exact version is picked at apply time [needs update at apply].
- New `adr/` folder at the repo root with the project's first ADR, on adopting TanStack Charts.
- Completion events live in server memory like todos: every client sees the same log, and it is lost on restart. The `/api/todos` contracts do not change.
