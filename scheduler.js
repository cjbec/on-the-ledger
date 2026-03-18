import cron from "node-cron";
import { runPipeline } from "./pipeline.js";
import { ingestRssFeeds } from "./rss.js";
import { ingestAllCompanies } from "./edgar.js";
import { extractAllSignals, generateBenchmarkRollup } from "./extractor.js";
import {
  initStorage, saveSignals, saveFeedItems,
  getLatestPerCompany, saveRollup, updateMeta, getMeta,
} from "./storage.js";
import companies from "./companies.json" with { type: "json" };

const SCHEDULES = {
  rss:    "0 7 * * *",
  edgar:  "0 8 * * *",
  full:   "0 8 * * *",
  rollup: "0 9 * * *",
};

async function runRssOnly() {
  console.log(`[${timestamp()}] RSS job starting`);
  await initStorage();
  const items = await ingestRssFeeds(companies, 30);
  const { added } = await saveFeedItems(items);
  console.log(`[${timestamp()}] RSS job complete — +${added} new items`);
}

async function runEdgarOnly() {
  console.log(`[${timestamp()}] EDGAR job starting`);
  await initStorage();
  const filings = await ingestAllCompanies(companies, 90);
  const signals = await extractAllSignals(filings);
  const { added, total } = await saveSignals(signals);
  await updateMeta(total);
  console.log(`[${timestamp()}] EDGAR job complete — +${added} new signals`);
}

async function runRollupOnly() {
  console.log(`[${timestamp()}] Rollup job starting`);
  await initStorage();
  const latest = await getLatestPerCompany();
  if (latest.length === 0) {
    console.log(`[${timestamp()}] No signals found — skipping rollup`);
    return;
  }
  const rollupText = await generateBenchmarkRollup(latest);
  await saveRollup(rollupText);
  console.log(`[${timestamp()}] Rollup job complete`);
}

async function logHealth() {
  try {
    const meta = await getMeta();
    console.log(`[${timestamp()}] Health — Last run: ${meta.lastRun ?? "never"} | Signals: ${meta.totalSignals}`);
  } catch {
    console.log(`[${timestamp()}] Health — No metadata found yet`);
  }
}

function startScheduler() {
  console.log(`[${timestamp()}] On The Ledger Scheduler starting...`);
  for (const [name, expr] of Object.entries(SCHEDULES)) {
    if (!cron.validate(expr)) throw new Error(`Invalid cron expression for "${name}": ${expr}`);
    console.log(`  Registered: ${name} → "${expr}"`);
  }
  cron.schedule(SCHEDULES.rss,    async () => safeRun("RSS", runRssOnly));
  cron.schedule(SCHEDULES.edgar,  async () => safeRun("EDGAR", runEdgarOnly));
  cron.schedule(SCHEDULES.full,   async () => safeRun("Full Pipeline", runPipeline));
  cron.schedule(SCHEDULES.rollup, async () => safeRun("Rollup", runRollupOnly));
  cron.schedule("0 * * * *", logHealth);
  console.log(`[${timestamp()}] Scheduler running.\n`);
  logHealth();
}

async function safeRun(jobName, fn) {
  console.log(`[${timestamp()}] ┌── ${jobName} starting`);
  const start = Date.now();
  try {
    await fn();
    console.log(`[${timestamp()}] └── ${jobName} complete (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  } catch (err) {
    console.error(`[${timestamp()}] └── ${jobName} FAILED:`, err.message);
  }
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").split(".")[0];
}

const arg = process.argv[2];
const target = process.argv[3];

if (arg === "--run") {
  const jobs = { rss: runRssOnly, edgar: runEdgarOnly, rollup: runRollupOnly, full: runPipeline };
  const job = jobs[target];
  if (!job) {
    console.error(`Unknown job "${target}". Options: ${Object.keys(jobs).join(", ")}`);
    process.exit(1);
  }
  safeRun(target, job).then(() => process.exit(0));
} else {
  startScheduler();
}

export { startScheduler, runRssOnly, runEdgarOnly, runRollupOnly };
