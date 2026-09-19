import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { getStore } = await import("../lib/server/store");
const { processJob, runRetention } = await import("../lib/moderation/service");
const store = getStore();
let stopping = false;
let lastRetention = 0;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
console.info(JSON.stringify({ event: "moderation_worker_ready" }));
while (!stopping) {
  try {
    if (Date.now() - lastRetention > 60000) {
      await runRetention(store);
      lastRetention = Date.now();
    }
    const job = store.claimJob();
    if (job) await processJob(store, job);
    else await new Promise((resolve) => setTimeout(resolve, 1500));
  } catch {
    console.error(
      JSON.stringify({
        event: "moderation_worker_error",
        code: "JOB_NOT_COMMITTED",
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}
store.close();
