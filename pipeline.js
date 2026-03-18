import { ingestAllCompanies } from "./edgar.js";
import { ingestRssFeeds } from "./rss.js";
import { extractAllSignals, generateBenchmarkRollup } from "./extractor.js";
import {
  initStorage, saveSignals, saveFeedItems,
  getLatestPerCompany, saveRollup, updateMeta,
} from "./storage.js";
import companies from "./companies.json" with { type: "json" };

async function runPipeline() {
  console.log("─── On The Ledger Pipeline ───────────────────────");
  await initStorage();

  console.log("\n[ 1/5 ] EDGAR Ingestion");
  const filings = await ingestAllCompanies(companies, 90);
  console.log(`  ${filings.length} filings ingested`);

  console.log("\n[ 2/5 ] RSS Ingestion");
  const feedItems = await ingestRssFeeds(companies, 30);
  console.log(`  ${feedItems.length} feed items ingested`);

  console.log("\n[ 3/5 ] Signal Extraction");
  const signals = await extractAllSignals(filings);
  console.log(`  ${signals.length} signals extracted`);

  console.log("\n[ 4/5 ] Saving to Storage");
  const { added: newSignals, total: totalSignals } = await saveSignals(signals);
  const { added: newItems } = await saveFeedItems(feedItems);
  console.log(`  Signals: +${newSignals} new (${totalSignals} total)`);
  console.log(`  Feed items: +${newItems} new`);

  console.log("\n[ 5/5 ] Generating Benchmark Rollup");
  const latest = await getLatestPerCompany();
  const rollupText = await generateBenchmarkRollup(latest);
  await saveRollup(rollupText);
  await updateMeta(totalSignals);

  console.log("\n─── Pipeline Complete ────────────────────────────");
}

export { runPipeline };
