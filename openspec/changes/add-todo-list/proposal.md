## Why

The app still shows the create-next-app placeholder at `/`, which does nothing for a user. We want that screen to be a working todo list where people add, edit, remove, complete and uncomplete items.

## What Changes

- **BREAKING**: The scaffold home page at `/` (Next.js logo, "To get started, edit the page.tsx file", Templates, Learning, Deploy Now and Documentation links) is removed. The todo list takes its place.
- The home screen lists all todos and shows an empty-state message when there are none.
- Users can add a todo by typing a title and submitting. Empty or whitespace-only titles are rejected.
- Users can edit a todo's title inline. Escape cancels the edit and restores the original title.
- Users can remove a todo.
- Users can mark a todo complete and mark it incomplete again. Completed todos look visibly different.
- A server-side JSON API under `/api/todos` (Next.js Route Handlers acting as a BFF) stores todos in server memory. Every client sees the same list until the server process restarts.

Out of scope: persistence across restarts, authentication and per-user lists, filtering, reordering, due dates, bulk actions and automated tests.

## Capabilities

### New Capabilities

- `todo-list`: The todo list on the home screen. Covers listing, adding, editing, removing, completing and uncompleting todos, the API behind these actions, and how long todos are kept (the server process lifetime).

### Modified Capabilities

None.

## Impact

- `app/page.tsx`: scaffold content replaced by the todo list.
- New UI component for the list (client component under `app/`).
- New in-memory todo store module under `lib/todos/`.
- New HTTP API: `GET`/`POST /api/todos` and `PATCH`/`DELETE /api/todos/{id}`.
- No new dependencies. No database or external services.
- Todos live only in the memory of one server process. They disappear on restart and are not shared between multiple server instances.
