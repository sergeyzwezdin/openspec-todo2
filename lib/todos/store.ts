/** A single todo item as stored on the server and returned by the API. */
export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  /** ISO 8601 creation timestamp. */
  createdAt: string;
};

/** Fields a client may change on an existing todo; absent fields stay as they are. */
export type TodoChanges = {
  title?: string;
  completed?: boolean;
};

/** Why a store operation was rejected. */
export type TodoError = "invalid-title" | "not-found";

/** Outcome of a store operation, narrowed per function to the errors it can produce. */
export type TodoResult<T, E extends TodoError = TodoError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

declare global {
  /** Process-wide todo collection, kept on `globalThis` so dev HMR and separate route bundles share it. */
  var __todoListStore: Map<string, Todo> | undefined;
}

/** Todos keyed by id; a `Map` keeps insertion order, so iteration is oldest first. */
const todos: Map<string, Todo> = (globalThis.__todoListStore ??= new Map<string, Todo>());

/** All todos, oldest first, as copies. */
export const listTodos = (): Todo[] => Array.from(todos.values(), copyTodo);

/** Creates an incomplete todo from the trimmed title, rejecting an empty one. */
export const createTodo = (title: string): TodoResult<Todo, "invalid-title"> => {
  const trimmedTitle = title.trim();
  if (trimmedTitle === "") return { ok: false, error: "invalid-title" };

  const todo: Todo = {
    id: crypto.randomUUID(),
    title: trimmedTitle,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  todos.set(todo.id, todo);
  return { ok: true, value: copyTodo(todo) };
};

/**
 * Applies the changes to an existing todo. The title is checked before the id is looked up,
 * so an empty title is reported as `invalid-title` even for an unknown id.
 */
export const updateTodo = (id: string, changes: TodoChanges): TodoResult<Todo> => {
  const title = changes.title?.trim();
  if (title === "") return { ok: false, error: "invalid-title" };

  const existing = todos.get(id);
  if (existing === undefined) return { ok: false, error: "not-found" };

  const updated: Todo = {
    ...existing,
    title: title ?? existing.title,
    completed: changes.completed ?? existing.completed,
  };
  todos.set(id, updated);
  return { ok: true, value: copyTodo(updated) };
};

/** Removes a todo and returns a copy of it. */
export const deleteTodo = (id: string): TodoResult<Todo, "not-found"> => {
  const existing = todos.get(id);
  if (existing === undefined) return { ok: false, error: "not-found" };

  todos.delete(id);
  return { ok: true, value: copyTodo(existing) };
};

/** Shallow copy, enough because every field is a primitive; keeps callers off the stored object. */
const copyTodo = (todo: Todo): Todo => ({ ...todo });
