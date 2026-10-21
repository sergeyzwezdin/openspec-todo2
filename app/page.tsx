import type { ReactElement } from "react";
import { HomeDashboard } from "./home-dashboard";

/** Home screen: completion chart and the shared todo list. The default export is required by the App Router. */
const Home = (): ReactElement => (
  <div className="flex flex-1 flex-col items-center bg-zinc-50 font-sans dark:bg-black">
    <main className="flex w-full max-w-2xl flex-1 flex-col gap-8 bg-white px-6 py-16 dark:bg-black sm:px-16">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">Todos</h1>
      <HomeDashboard />
    </main>
  </div>
);

export default Home;
