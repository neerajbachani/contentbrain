import { runTrendJob } from "./trendJob";
import { BOOTSTRAP_NICHES } from "../services/nicheData";
import { logTrends } from "../services/trendsLogger";

// Simple cron-like scheduler using setInterval (no external dep needed)
// For production, swap with node-cron

let schedulerStarted = false;

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const apifyXEnabled =
    !!process.env.APIFY_API_TOKEN && process.env.APIFY_X_TRENDS_ENABLED !== "false";

  logTrends("scheduler_bootstrap", { apifyX: apifyXEnabled });
  console.log(
    `[Scheduler] Bootstrap fetch scheduled in 10s... (Apify X: ${apifyXEnabled ? "on" : "off"})`
  );
  // Delay bootstrap so the server finishes starting before running network jobs
  setTimeout(() => {
    runTrendJob({
      niches: BOOTSTRAP_NICHES,
      includeNewsData: true,
      includeApify: apifyXEnabled,
      maxItemsPerPlatform: 10,
    }).catch(console.error);
  }, 10_000);

  // Google RSS every 15 minutes (free, zero-cost)
  setInterval(
    async () => {
      console.log("[Scheduler] Running 15-min Google RSS refresh...");
      await runTrendJob({ googleRssOnly: true }).catch(console.error);
    },
    15 * 60 * 1000
  );

  // Full job (Reddit + NewsData + RSS) every 60 minutes
  setInterval(
    async () => {
      const apifyX =
        !!process.env.APIFY_API_TOKEN && process.env.APIFY_X_TRENDS_ENABLED !== "false";
      logTrends("scheduler_hourly", { apifyX });
      console.log(`[Scheduler] Running 60-min full trend job... (Apify X: ${apifyX ? "on" : "off"})`);
      await runTrendJob({ includeApify: apifyX, includeNewsData: true }).catch(console.error);
    },
    60 * 60 * 1000
  );

  console.log("[Scheduler] Started: bootstrap + 15-min RSS + 60-min full job");
}
