"use client";

import { useState } from "react";
import type { ReactElement } from "react";
import { CompletionChart } from "./completion-chart";
import { TodoList } from "./todo-list";

/** Completion chart above the todo list; the chart refetches whenever a todo's completion flips. */
export const HomeDashboard = (): ReactElement => {
  const [reloadKey, setReloadKey] = useState<number>(0);

  return (
    <>
      <CompletionChart reloadKey={reloadKey} />
      <TodoList onCompletionChange={() => setReloadKey((current) => current + 1)} />
    </>
  );
};
