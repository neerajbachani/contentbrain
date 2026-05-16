import { runTrendJob } from "./trendJob";

// Simple cron-like scheduler using setInterval (no external dep needed)
// For production, swap with node-cron

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Google RSS every 15 minutes (free, zero-cost)
  setInterval(
    async () => {
      console.log("[Scheduler] Running 15-min Google RSS refresh...");
      await runTrendJob({ googleRssOnly: true }).catch(console.error);
    },
    15 * 60 * 1000
  );

  // Full job (Reddit + NewsData) every 6 hours
  setInterval(
    async () => {
      console.log("[Scheduler] Running 6-hour full trend job...");
      await runTrendJob({ includeApify: false, includeNewsData: true }).catch(console.error);
    },
    6 * 60 * 60 * 1000
  );

  console.log("[Scheduler] Started: 15-min RSS + 6h full job");
}
