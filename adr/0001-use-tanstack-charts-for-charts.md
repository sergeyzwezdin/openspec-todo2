# ADR-0001: Use TanStack Charts for charts

- Status: accepted
- Date: 2026-10-21
- Supersedes: none

## Context

The `add-completion-stats-chart` change adds the project's first chart: a bar chart on `/` with completed todos per day for the last 14 days. The project had no charting code or library. We could draw the bars by hand in SVG or CSS, or add a library. The user chose a library. The first draft of this change picked Recharts; during review the user chose TanStack Charts instead.

## Decision

We use TanStack Charts (`@tanstack/charts`) as the project's charting library. It ships as one package with a React adapter at `@tanstack/charts/react`. React and React DOM 18 or 19 are optional peers and are already installed, so the install is `pnpm add @tanstack/charts`. The exact version is chosen at apply time [needs update at apply].

A chart is a definition built with `defineChart` from marks (for example `barY`) and scales (for example band and linear). The `<Chart>` component renders that definition. Without a `width` prop it fills its container, and `initialWidth` fixes the width used for server output.

Chart components are client components (`"use client"`). The app runs with Cache Components, so any work that depends on the current time or the viewer's locale runs in effects, never during render. Otherwise the prerendered shell and the first client render differ and React reports a hydration mismatch.

Future charts use TanStack Charts unless a new ADR supersedes this one.

## Consequences

- `@tanstack/charts` is the one new dependency to keep current.
- Pages with charts ship more client JavaScript. The size is not measured yet [unconfirmed]. The `add-completion-stats-chart` change records the size of `/` before and after.
- TanStack Charts is a young library with a short release history, so its API may change between versions [unconfirmed]. Upgrades need a check against the changelog.
- Chart definitions do not depend on React. They could move to another UI framework, but only the React adapter is used here.
- Charts need data before they draw, so they show a loading placeholder until it arrives.
