# todo-list Specification

## Purpose
TBD - created by archiving change add-todo-list. Update Purpose after archive.

## Requirements

### Requirement: Todo list is the home screen
The home screen at `/` SHALL show the todo list, ordered by creation time with the oldest first, and SHALL show an empty-state message when no todos exist.

#### Scenario: Home screen shows existing todos
- **GIVEN** the server holds the todos "Buy milk" and "Call Anna", created in that order
- **WHEN** the user opens `/`
- **THEN** the page shows "Buy milk" followed by "Call Anna"
- **AND** the scaffold content (Next.js logo, "To get started, edit the page.tsx file") is not shown

#### Scenario: Home screen shows empty state
- **GIVEN** the server holds no todos
- **WHEN** the user opens `/`
- **THEN** the page shows an empty-state message saying there are no todos
- **AND** the input for adding a todo is available

### Requirement: Add a todo
The system SHALL create a new incomplete todo from a submitted title after trimming surrounding whitespace, and MUST reject a title that is empty or whitespace-only.

#### Scenario: User adds a todo
- **GIVEN** the user is on `/`
- **WHEN** the user types "  Buy milk  " into the new-todo input and submits
- **THEN** a todo titled "Buy milk" appears at the end of the list, not completed
- **AND** the new-todo input is cleared

#### Scenario: User submits a whitespace-only title
- **GIVEN** the user is on `/` with an unchanged list
- **WHEN** the user types "   " into the new-todo input and submits
- **THEN** no todo is added to the list

#### Scenario: API creates a todo
- **GIVEN** the server holds no todos
- **WHEN** a client sends `POST /api/todos` with body `{"title": "Buy milk"}`
- **THEN** the response status is 201
- **AND** the body is a todo with a generated `id`, `title` "Buy milk", `completed` false and an ISO 8601 `createdAt`

#### Scenario: API rejects an empty title on create
- **GIVEN** the server holds no todos
- **WHEN** a client sends `POST /api/todos` with body `{"title": "  "}`
- **THEN** the response status is 400
- **AND** the server still holds no todos

### Requirement: Edit a todo title
The system SHALL let the user change a todo's title inline, MUST restore the original title when the edit is cancelled, and MUST reject an empty or whitespace-only title.

#### Scenario: User saves an edited title
- **GIVEN** the list contains the todo "Buy milk"
- **WHEN** the user enters edit mode on "Buy milk", changes the text to "Buy oat milk" and saves
- **THEN** the todo shows the title "Buy oat milk"
- **AND** its completed state is unchanged

#### Scenario: User cancels an edit with Escape
- **GIVEN** the list contains the todo "Buy milk"
- **AND** the user has entered edit mode on it and changed the text to "Buy bread"
- **WHEN** the user presses Escape
- **THEN** the todo leaves edit mode and shows the title "Buy milk"

#### Scenario: User saves an empty title
- **GIVEN** the list contains the todo "Buy milk"
- **AND** the user has entered edit mode on it and cleared the text
- **WHEN** the user saves
- **THEN** the todo keeps the title "Buy milk"

#### Scenario: API rejects an empty title on edit
- **GIVEN** the server holds a todo with id `abc` and title "Buy milk"
- **WHEN** a client sends `PATCH /api/todos/abc` with body `{"title": ""}`
- **THEN** the response status is 400
- **AND** the todo `abc` still has the title "Buy milk"

### Requirement: Remove a todo
The system SHALL delete a todo when the user removes it, without asking for confirmation.

#### Scenario: User removes a todo
- **GIVEN** the list contains the todos "Buy milk" and "Call Anna"
- **WHEN** the user clicks the delete button on "Buy milk"
- **THEN** "Buy milk" disappears from the list
- **AND** "Call Anna" is still shown

#### Scenario: API deletes a todo
- **GIVEN** the server holds a todo with id `abc`
- **WHEN** a client sends `DELETE /api/todos/abc`
- **THEN** the response status is 204
- **AND** a following `GET /api/todos` does not include a todo with id `abc`

### Requirement: Complete a todo
The system SHALL mark an incomplete todo as completed when the user checks it, and MUST show completed todos visually distinct from incomplete ones.

#### Scenario: User completes a todo
- **GIVEN** the list contains the incomplete todo "Buy milk"
- **WHEN** the user checks the checkbox next to "Buy milk"
- **THEN** the checkbox is checked
- **AND** the title "Buy milk" is shown with strikethrough

#### Scenario: API marks a todo completed
- **GIVEN** the server holds an incomplete todo with id `abc`
- **WHEN** a client sends `PATCH /api/todos/abc` with body `{"completed": true}`
- **THEN** the response status is 200
- **AND** the returned todo has `completed` true

### Requirement: Uncomplete a todo
The system SHALL mark a completed todo as incomplete when the user unchecks it.

#### Scenario: User uncompletes a todo
- **GIVEN** the list contains the completed todo "Buy milk"
- **WHEN** the user unchecks the checkbox next to "Buy milk"
- **THEN** the checkbox is unchecked
- **AND** the title "Buy milk" is shown without strikethrough

#### Scenario: API marks a todo incomplete
- **GIVEN** the server holds a completed todo with id `abc`
- **WHEN** a client sends `PATCH /api/todos/abc` with body `{"completed": false}`
- **THEN** the response status is 200
- **AND** the returned todo has `completed` false

### Requirement: Todos persist for the server process lifetime
The system MUST keep todos in server memory shared by all clients for as long as the server process runs, and SHALL NOT keep them after the process restarts.

#### Scenario: Todo survives a page reload
- **GIVEN** the user has added the todo "Buy milk"
- **WHEN** the user reloads `/`
- **THEN** the list still shows "Buy milk"

#### Scenario: Todo is visible in another browser
- **GIVEN** a user in one browser has added the todo "Buy milk"
- **WHEN** a different browser opens `/`
- **THEN** that browser's list shows "Buy milk"

#### Scenario: Todos are gone after a server restart
- **GIVEN** the server holds the todo "Buy milk"
- **WHEN** the server process is restarted and the user opens `/`
- **THEN** the page shows the empty-state message

### Requirement: API rejects unknown todo ids
The API MUST respond with status 404 to `PATCH` and `DELETE` requests for an id that does not exist, and MUST leave stored todos unchanged.

#### Scenario: Update an unknown todo
- **GIVEN** the server holds no todo with id `missing`
- **WHEN** a client sends `PATCH /api/todos/missing` with body `{"completed": true}`
- **THEN** the response status is 404

#### Scenario: Delete an unknown todo
- **GIVEN** the server holds no todo with id `missing`
- **WHEN** a client sends `DELETE /api/todos/missing`
- **THEN** the response status is 404
- **AND** the list returned by `GET /api/todos` is unchanged
