const APIFY_BASE = "https://api.apify.com/v2";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function pollApifyRun(
  runId: string,
  token: string,
  maxWaitMs = 45_000,
  itemLimit = 20
): Promise<any[]> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    await sleep(3000);

    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
    );
    const statusData = (await statusRes.json()) as any;
    const status = statusData?.data?.status;

    if (status === "SUCCEEDED") {
      const datasetId = statusData?.data?.defaultDatasetId;
      const dataRes = await fetch(
        `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&limit=${itemLimit}`
      );
      return ((await dataRes.json()) as any[]) ?? [];
    }

    if (status === "FAILED" || status === "ABORTED") {
      throw new Error(`Apify run ${runId} ended with status: ${status}`);
    }
  }

  throw new Error(`Apify run ${runId} timed out after ${maxWaitMs}ms`);
}

export async function runApifyActor(
  actorId: string,
  input: Record<string, unknown>,
  token: string,
  options?: { maxWaitMs?: number; itemLimit?: number }
): Promise<any[]> {
  const runRes = await fetch(`${APIFY_BASE}/acts/${actorId}/runs?token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!runRes.ok) {
    const errBody = await runRes.text();
    const hint =
      runRes.status === 403
        ? " — check APIFY_API_TOKEN at console.apify.com (regenerate if expired or wrong account)"
        : "";
    console.error(`[Apify] run start ${runRes.status}:`, errBody.slice(0, 300));
    throw new Error(`Apify run start failed: ${runRes.status}${hint}`);
  }

  const runData = (await runRes.json()) as any;
  const runId = runData?.data?.id;
  if (!runId) throw new Error("Apify run id missing");

  return pollApifyRun(runId, token, options?.maxWaitMs, options?.itemLimit);
}

export const APIFY_TWITTER_ACTOR = "quacker~twitter-scraper";
