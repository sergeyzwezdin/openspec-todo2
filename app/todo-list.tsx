"use client";

import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactElement } from "react";
import type { Todo } from "@/lib/todos/store";

/** Base path of the todo BFF API. */
const TODOS_API_URL = "/api/todos";

/** Shown when the request never reached the server. */
const NETWORK_ERROR_MESSAGE = "Could not reach the server. Please try again.";

/** Shown when the server answered with a body that is not what the API contract promises. */
const UNEXPECTED_RESPONSE_MESSAGE = "The server sent an unexpected response.";

/** Outcome of an API call: the parsed payload, or a message to show inline. */
type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Fields accepted by `PATCH /api/todos/{id}`. */
type TodoPatch = { title?: string; completed?: boolean };

/** Called after a confirmed PATCH flipped `completed`, in either direction. */
type TodoListProps = { onCompletionChange?: () => void };

/** Callbacks resolve to `true` once the server confirmed the change. */
type TodoActions = {
  onUpdate: (id: string, patch: TodoPatch) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
};

/** Todo list backed by the `/api/todos` API; state changes only after the server confirms. */
export const TodoList = ({ onCompletionChange }: TodoListProps): ReactElement => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    let isCancelled = false;
    void requestTodos().then((result) => {
      if (isCancelled) return;
      if (result.ok) setTodos(result.data);
      else setErrorMessage(result.error);
      setIsLoaded(true);
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  const applyResult = <T,>(result: ApiResult<T>, apply: (data: T) => void): boolean => {
    if (!result.ok) {
      setErrorMessage(result.error);
      return false;
    }
    setErrorMessage(undefined);
    apply(result.data);
    return true;
  };

  const addTodo = async (title: string): Promise<boolean> =>
    applyResult(await requestCreateTodo(title), (created) =>
      setTodos((current) => [...current, created]),
    );

  const updateTodo = async (id: string, patch: TodoPatch): Promise<boolean> => {
    const previous = todos.find((todo) => todo.id === id);
    return applyResult(await requestUpdateTodo(id, patch), (updated) => {
      setTodos((current) => current.map((todo) => (todo.id === updated.id ? updated : todo)));
      if (previous !== undefined && previous.completed !== updated.completed) onCompletionChange?.();
    });
  };

  const deleteTodo = async (id: string): Promise<boolean> =>
    applyResult(await requestDeleteTodo(id), () =>
      setTodos((current) => current.filter((todo) => todo.id !== id)),
    );

  return (
    <section className="flex w-full flex-col gap-6">
      <NewTodoForm onAdd={addTodo} />
      {errorMessage !== undefined && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {errorMessage}
        </p>
      )}
      {!isLoaded ? (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : todos.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400">No todos yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {todos.map((todo) => (
            <TodoItem key={todo.id} todo={todo} onUpdate={updateTodo} onDelete={deleteTodo} />
          ))}
        </ul>
      )}
    </section>
  );
};

/** Input and submit button for a new todo; skips blank titles and clears itself on success. */
const NewTodoForm = ({ onAdd }: { onAdd: (title: string) => Promise<boolean> }): ReactElement => {
  const [title, setTitle] = useState<string>("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed === "") return;
    if (await onAdd(trimmed)) setTitle("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        aria-label="New todo title"
        placeholder="What needs to be done?"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-300"
      >
        Add
      </button>
    </form>
  );
};

/** One row of the list: completion checkbox, title (or its editor) and actions. */
const TodoItem = ({ todo, onUpdate, onDelete }: { todo: Todo } & TodoActions): ReactElement => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const saveTitle = async (title: string): Promise<void> => {
    if (title === "" || (await onUpdate(todo.id, { title }))) setIsEditing(false);
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <input
        type="checkbox"
        aria-label={`Mark "${todo.title}" as ${todo.completed ? "not completed" : "completed"}`}
        checked={todo.completed}
        onChange={() => void onUpdate(todo.id, { completed: !todo.completed })}
        className="size-4 accent-zinc-900 dark:accent-zinc-50"
      />
      {isEditing ? (
        <TodoTitleEditor todo={todo} onSave={saveTitle} onCancel={() => setIsEditing(false)} />
      ) : (
        <TodoTitleView todo={todo} onEdit={() => setIsEditing(true)} onDelete={onDelete} />
      )}
    </li>
  );
};

/** Read-only title with Edit and Delete buttons; clicking the title also starts editing. */
const TodoTitleView = ({
  todo,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  onEdit: () => void;
  onDelete: TodoActions["onDelete"];
}): ReactElement => (
  <>
    <button
      type="button"
      onClick={onEdit}
      className={`flex-1 text-left ${todo.completed ? "text-zinc-400 line-through dark:text-zinc-500" : "text-zinc-950 dark:text-zinc-50"}`}
    >
      {todo.title}
    </button>
    <button type="button" aria-label={`Edit "${todo.title}"`} onClick={onEdit} className={secondaryButtonClass}>
      Edit
    </button>
    <button
      type="button"
      aria-label={`Delete "${todo.title}"`}
      onClick={() => void onDelete(todo.id)}
      className={secondaryButtonClass}
    >
      Delete
    </button>
  </>
);

/** Inline title input: Enter or Save submits the trimmed title, Escape cancels. */
const TodoTitleEditor = ({
  todo,
  onSave,
  onCancel,
}: {
  todo: Todo;
  onSave: (title: string) => Promise<void>;
  onCancel: () => void;
}): ReactElement => {
  const [draft, setDraft] = useState<string>(todo.title);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void onSave(draft.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") onCancel();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 gap-2">
      <input
        type="text"
        aria-label={`Edit title of "${todo.title}"`}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-zinc-950 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <button type="submit" className={secondaryButtonClass}>
        Save
      </button>
    </form>
  );
};

/** Shared styling of the small per-row buttons. */
const secondaryButtonClass =
  "rounded-md border border-zinc-300 px-2 py-1 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

/** Loads every todo, oldest first. */
const requestTodos = (): Promise<ApiResult<Todo[]>> =>
  requestJson(TODOS_API_URL, { method: "GET", cache: "no-store" }, isTodoArray);

/** Creates a todo from an already trimmed, non-empty title. */
const requestCreateTodo = (title: string): Promise<ApiResult<Todo>> =>
  requestJson(TODOS_API_URL, jsonInit("POST", { title }), isTodo);

/** Applies a partial update and returns the todo as stored by the server. */
const requestUpdateTodo = (id: string, patch: TodoPatch): Promise<ApiResult<Todo>> =>
  requestJson(getTodoUrl(id), jsonInit("PATCH", patch), isTodo);

/** Deletes a todo; the API answers 204 with no body. */
const requestDeleteTodo = async (id: string): Promise<ApiResult<undefined>> => {
  const result = await sendRequest(getTodoUrl(id), { method: "DELETE" });
  return result.ok ? { ok: true, data: undefined } : result;
};

/** URL of a single todo, with the id escaped for use as a path segment. */
const getTodoUrl = (id: string): string => `${TODOS_API_URL}/${encodeURIComponent(id)}`;

/** Request options for a JSON body. */
const jsonInit = (method: "POST" | "PATCH", body: object): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

/** Sends a request and parses a JSON success body, rejecting bodies that fail `isExpected`. */
const requestJson = async <T,>(
  url: string,
  init: RequestInit,
  isExpected: (value: unknown) => value is T,
): Promise<ApiResult<T>> => {
  const result = await sendRequest(url, init);
  if (!result.ok) return result;
  const body = await readJson(result.data);
  return isExpected(body) ? { ok: true, data: body } : { ok: false, error: UNEXPECTED_RESPONSE_MESSAGE };
};

/** Sends a request, turning network failures and non-2xx statuses into an error result. */
const sendRequest = async (url: string, init: RequestInit): Promise<ApiResult<Response>> => {
  try {
    const response = await fetch(url, init);
    if (response.ok) return { ok: true, data: response };
    return { ok: false, error: await readErrorMessage(response) };
  } catch {
    return { ok: false, error: NETWORK_ERROR_MESSAGE };
  }
};

/** Message from a `{ "error": string }` body, or a generic one naming the status. */
const readErrorMessage = async (response: Response): Promise<string> => {
  const body = await readJson(response);
  if (isRecord(body) && typeof body.error === "string") return body.error;
  return `Request failed with status ${response.status}.`;
};

/** Parsed JSON body, or `undefined` when the body is empty or not JSON. */
const readJson = async (response: Response): Promise<unknown> => {
  try {
    const body: unknown = await response.json();
    return body;
  } catch {
    return undefined;
  }
};

/** Narrows an unknown value to a todo as described by the API contract. */
const isTodo = (value: unknown): value is Todo =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.title === "string" &&
  typeof value.completed === "boolean" &&
  typeof value.createdAt === "string";

/** Narrows an unknown value to a list of todos. */
const isTodoArray = (value: unknown): value is Todo[] => Array.isArray(value) && value.every(isTodo);

/** Narrows an unknown value to a plain object whose keys can be read. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
