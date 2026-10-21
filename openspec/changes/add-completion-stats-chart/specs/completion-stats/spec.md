## ADDED Requirements

### Requirement: Record a completion event
The system SHALL append a completion event `{ todoId, completedAt }`, with `completedAt` as an ISO 8601 timestamp, each time a todo changes from incomplete to completed, whether through the checkbox on `/` or through `PATCH /api/todos/{id}` with `{"completed": true}`. It MUST NOT append an event for any other change to a todo.

#### Scenario: Completing a todo records one event
- **GIVEN** the server holds an incomplete todo with id `abc`
- **AND** the completion log is empty
- **WHEN** a client sends `PATCH /api/todos/abc` with body `{"completed": true}`
- **THEN** the completion log holds exactly one event
- **AND** that event has `todoId` `abc` and an ISO 8601 `completedAt`

#### Scenario: Completing an already completed todo records nothing
- **GIVEN** the server holds a completed todo with id `abc`
- **AND** the completion log holds one event for `abc`
- **WHEN** a client sends `PATCH /api/todos/abc` with body `{"completed": true}`
- **THEN** the response status is 200
- **AND** the completion log still holds one event for `abc`

#### Scenario: Editing only the title records nothing
- **GIVEN** the server holds an incomplete todo with id `abc` and title "Buy milk"
- **AND** the completion log is empty
- **WHEN** a client sends `PATCH /api/todos/abc` with body `{"title": "Buy oat milk"}`
- **THEN** the completion log is still empty

#### Scenario: Completing again after unchecking records a second event
- **GIVEN** the server holds an incomplete todo with id `abc`
- **WHEN** a client completes `abc`, uncompletes it, and completes it again with `PATCH /api/todos/abc`
- **THEN** the completion log holds exactly two events with `todoId` `abc`

### Requirement: Past completions are never reduced
The system MUST keep every recorded completion event when its todo is later uncompleted or deleted.

#### Scenario: Unchecking a todo keeps its event
- **GIVEN** the user completed the todo "Buy milk" today and today's bar shows 1
- **WHEN** the user unchecks "Buy milk"
- **THEN** the completion log still holds the event for "Buy milk"
- **AND** after a reload of `/`, today's bar still shows 1

#### Scenario: Deleting a todo keeps its event
- **GIVEN** the server holds a completed todo with id `abc` and one completion event for `abc` recorded today
- **WHEN** a client sends `DELETE /api/todos/abc`
- **THEN** `GET /api/completions` with a `since` before that event still returns the event for `abc`
- **AND** after a reload of `/`, today's bar still shows 1

### Requirement: Completions API
`GET /api/completions?since=<ISO 8601>` SHALL respond with status 200 and a JSON array of `{ todoId, completedAt }` objects holding only events with `completedAt` at or after `since`, oldest first. It MUST respond with status 400 and body `{ "error": string }` when `since` is missing or is not a valid date.

#### Scenario: API returns events since a given instant
- **GIVEN** the completion log holds events for `a` at `2026-10-07T23:59:59Z`, `b` at `2026-10-08T00:00:00Z` and `c` at `2026-10-15T09:00:00Z`
- **WHEN** a client sends `GET /api/completions?since=2026-10-08T00:00:00Z`
- **THEN** the response status is 200
- **AND** the body is `[{"todoId": "b", "completedAt": "2026-10-08T00:00:00Z"}, {"todoId": "c", "completedAt": "2026-10-15T09:00:00Z"}]`

#### Scenario: API returns an empty array when no events match
- **GIVEN** the completion log holds one event at `2026-10-01T12:00:00Z`
- **WHEN** a client sends `GET /api/completions?since=2026-10-08T00:00:00Z`
- **THEN** the response status is 200
- **AND** the body is `[]`

#### Scenario: API rejects a missing since
- **WHEN** a client sends `GET /api/completions`
- **THEN** the response status is 400
- **AND** the body is an object with a string `error`

#### Scenario: API rejects an invalid since
- **WHEN** a client sends `GET /api/completions?since=yesterday`
- **THEN** the response status is 400
- **AND** the body is an object with a string `error`

### Requirement: Completion chart on the home screen
The home screen at `/` SHALL show a bar chart above the todo list with exactly 14 bars: today on the right and the 13 previous days to its left, in order. Each bar MUST equal the number of completion events whose `completedAt` falls on that calendar day in the viewer's local timezone. Days without events MUST show 0, and events before the earliest day MUST NOT be counted.

#### Scenario: Chart shows 14 days with per-day counts
- **GIVEN** today is 2026-10-21 in the viewer's timezone, UTC
- **AND** the completion log holds two events on 2026-10-21, one on 2026-10-15 and one at `2026-10-07T12:00:00Z`
- **WHEN** the user opens `/`
- **THEN** the chart appears above the todo list with 14 bars, from 2026-10-08 on the left to 2026-10-21 on the right
- **AND** the 2026-10-21 bar shows 2, the 2026-10-15 bar shows 1 and the other 12 bars show 0

#### Scenario: Chart groups events by the viewer's local day
- **GIVEN** the viewer's timezone is UTC+3 and today is 2026-10-21 there
- **AND** the completion log holds one event at `2026-10-20T22:30:00Z`
- **WHEN** the user opens `/`
- **THEN** the 2026-10-21 bar shows 1
- **AND** the 2026-10-20 bar shows 0

#### Scenario: Chart with no completions
- **GIVEN** the completion log is empty
- **WHEN** the user opens `/`
- **THEN** the chart shows 14 bars, all at 0

### Requirement: Chart refreshes without a reload
The chart SHALL refetch completion events after the user checks or unchecks a todo on `/`, without a page reload.

#### Scenario: Checking a todo raises today's bar
- **GIVEN** the user is on `/`, the list contains the incomplete todo "Buy milk" and today's bar shows 2
- **WHEN** the user checks "Buy milk"
- **THEN** today's bar shows 3 without the page reloading

#### Scenario: Unchecking a todo leaves today's bar unchanged
- **GIVEN** the user is on `/`, the list contains the completed todo "Buy milk" and today's bar shows 3
- **WHEN** the user unchecks "Buy milk"
- **THEN** today's bar still shows 3

### Requirement: Chart failure does not block the todo list
When the completions request fails, the home screen SHALL show an inline error message in place of the chart, and the todo list MUST remain usable.

#### Scenario: Completions request fails
- **GIVEN** `GET /api/completions` responds with status 500
- **AND** the server holds the incomplete todo "Buy milk"
- **WHEN** the user opens `/`
- **THEN** an error message is shown where the chart would be
- **AND** the list shows "Buy milk"
- **AND** the user can check "Buy milk" and see it marked completed

### Requirement: Completion log lives for the server process lifetime
The system MUST keep completion events in server memory shared by all clients for as long as the server process runs, and SHALL NOT keep them after the process restarts.

#### Scenario: Completion is visible in another browser
- **GIVEN** a user in one browser has completed a todo today
- **WHEN** a different browser opens `/`
- **THEN** that browser's chart shows 1 on today's bar

#### Scenario: Completions are gone after a server restart
- **GIVEN** the completion log holds three events from today
- **WHEN** the server process is restarted and the user opens `/`
- **THEN** the chart shows 14 bars, all at 0
