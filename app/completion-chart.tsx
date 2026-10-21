"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import type { CompletionEvent } from "@/lib/todos/store";

/** Endpoint returning completion events at or after `since`, oldest first. */
const COMPLETIONS_API_URL = "/api/completions";

/** Number of local calendar days shown, today included. */
const DAY_COUNT = 14;

/** Fixed chart height in pixels, shared by the placeholder so the layout does not jump. */
const CHART_HEIGHT = 240;

/** Server and pre-measurement width; the chart then follows its container. */
const CHART_INITIAL_WIDTH = 640;

/** Upper bound on y tick count, so large counts do not crowd the axis. */
const MAX_Y_TICKS = 5;

/** Shown in place of the chart when the completions request fails. */
const LOAD_ERROR_MESSAGE = "Could not load completion stats.";

/** Completions on one local calendar day; `label` is preformatted in the viewer's locale. */
type DayCount = { key: string; label: string; count: number };

/** Chart state: not loaded yet, loaded days, or a failed request. */
type ChartState = { status: "loading" } | { status: "loaded"; days: DayCount[] } | { status: "error" };

/** Bar chart of completions per local day over the last 14 days; refetches when `reloadKey` changes. */
export const CompletionChart = ({ reloadKey }: { reloadKey: number }): ReactElement => {
  const [state, setState] = useState<ChartState>({ status: "loading" });

  useEffect(() => {
    let isCancelled = false;
    const days = getLastLocalDays(DAY_COUNT);
    void requestCompletions(days[0]).then((events) => {
      if (isCancelled) return;
      setState(events === undefined ? { status: "error" } : { status: "loaded", days: countByDay(days, events) });
    });
    return () => {
      isCancelled = true;
    };
  }, [reloadKey]);

  return (
    <section className="flex w-full flex-col gap-3 text-zinc-950 dark:text-zinc-50">
      <h2 className="text-lg font-medium">Completed in the last 14 days</h2>
      {state.status === "loaded" ? (
        <CompletionBars days={state.days} />
      ) : state.status === "error" ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {LOAD_ERROR_MESSAGE}
        </p>
      ) : (
        <div aria-hidden="true" style={{ height: CHART_HEIGHT }} className="w-full rounded-md bg-zinc-100 dark:bg-zinc-900" />
      )}
    </section>
  );
};

/** TanStack bar chart over already counted days; the definition is rebuilt only when `days` changes. */
const CompletionBars = ({ days }: { days: DayCount[] }): ReactElement => {
  const definition = useMemo(() => {
    const yTicks = getWholeNumberTicks(Math.max(0, ...days.map((day) => day.count)));
    return defineChart({
      marks: [barY(days, { x: "label", y: "count", key: "key" })],
      scales: {
        x: { scale: () => scaleBand<string>().padding(0.2) },
        y: {
          scale: scaleLinear().domain([0, yTicks[yTicks.length - 1]]),
          grid: true,
          axis: { ticks: { values: yTicks, format: (value: number) => String(value) } },
        },
      },
      tooltip: {
        use: tooltip,
        items: [
          { channel: "x", label: "Day" },
          { channel: "y", label: "Completed" },
        ],
      },
    });
  }, [days]);

  return (
    <Chart
      definition={definition}
      height={CHART_HEIGHT}
      initialWidth={CHART_INITIAL_WIDTH}
      ariaLabel="Completed todos per day over the last 14 days"
    />
  );
};

/** Local midnights of the last `count` days, oldest first; steps by calendar day so DST cannot shift a day. */
const getLastLocalDays = (count: number): Date[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (count - 1 - index));
    return day;
  });
};

/** Buckets events by local calendar date; days without events get 0 and events outside the days are dropped. */
const countByDay = (days: Date[], events: CompletionEvent[]): DayCount[] => {
  const counts = new Map<string, number>(days.map((day) => [getLocalDayKey(day), 0]));
  for (const event of events) {
    const key = getLocalDayKey(new Date(event.completedAt));
    const current = counts.get(key);
    if (current !== undefined) counts.set(key, current + 1);
  }
  return days.map((day) => {
    const key = getLocalDayKey(day);
    return { key, label: formatDayLabel(day), count: counts.get(key) ?? 0 };
  });
};

/** Local `y-m-d` key of a date, independent of the time of day. */
const getLocalDayKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

/** Short weekday and day of month in the viewer's locale, for example "Mon 19". */
const formatDayLabel = (date: Date): string => date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });

/** Integer tick values from 0 covering `maxCount`, at most `MAX_Y_TICKS + 1` of them; all-zero data gets `[0, 1]`. */
const getWholeNumberTicks = (maxCount: number): number[] => {
  const step = Math.max(1, Math.ceil(maxCount / MAX_Y_TICKS));
  const top = Math.max(1, Math.ceil(maxCount / step)) * step;
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
};

/** Events since the given instant, or `undefined` when the request fails or the body is not as promised. */
const requestCompletions = async (since: Date): Promise<CompletionEvent[] | undefined> => {
  try {
    const response = await fetch(`${COMPLETIONS_API_URL}?since=${encodeURIComponent(since.toISOString())}`, {
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const body: unknown = await response.json();
    return isCompletionEventArray(body) ? body : undefined;
  } catch {
    return undefined;
  }
};

/** Narrows an unknown value to a list of completion events as described by the API contract. */
const isCompletionEventArray = (value: unknown): value is CompletionEvent[] =>
  Array.isArray(value) && value.every(isCompletionEvent);

/** Narrows an unknown value to one completion event. */
const isCompletionEvent = (value: unknown): value is CompletionEvent =>
  typeof value === "object" &&
  value !== null &&
  "todoId" in value &&
  typeof value.todoId === "string" &&
  "completedAt" in value &&
  typeof value.completedAt === "string";
