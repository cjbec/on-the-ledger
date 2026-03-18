import fs from "fs/promises";
import path from "path";

const DATA_DIR = "./data";
const SIGNALS_FILE = path.join(DATA_DIR, "signals.json");
const ROLLUP_FILE = path.join(DATA_DIR, "rollup.json");
const META_FILE = path.join(DATA_DIR, "meta.json");
const FEED_FILE = path.join(DATA_DIR, "feed.json");

async function initStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await seedIfMissing(SIGNALS_FILE, []);
  await seedIfMissing(ROLLUP_FILE, []);
  await seedIfMissing(META_FILE, { lastRun: null, totalSignals: 0 });
  await seedIfMissing(FEED_FILE, []);
  console.log("Storage initialized at ./data");
}

async function seedIfMissing(filePath, defaultValue) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2));
  }
}

async function loadSignals() {
  const raw = await fs.readFile(SIGNALS_FILE, "utf-8");
  return JSON.parse(raw);
}

async function saveSignals(newSignals) {
  const existing = await loadSignals();
  const existingKeys = new Set(existing.map(dedupeKey));
  const fresh = newSignals.filter((s) => !existingKeys.has(dedupeKey(s)));
  if (fresh.length === 0) {
    console.log("No new signals to save — all duplicates");
    return { added: 0, total: existing.length };
  }
  const merged = [...existing, ...fresh].sort(
    (a, b) => new Date(b.filingDate) - new Date(a.filingDate)
  );
  await fs.writeFile(SIGNALS_FILE, JSON.stringify(merged, null, 2));
  console.log(`Saved ${fresh.length} new signals (${merged.length} total)`);
  return { added: fresh.length, total: merged.length };
}

async function querySignals({ company, filingType, since, limit } = {}) {
  let results = await loadSignals();
  if (company) results = results.filter((s) => s.company.toLowerCase() === company.toLowerCase());
  if (filingType) results = results.filter((s) => s.filingType === filingType);
  if (since) {
    const cutoff = new Date(since);
    results = results.filter((s) => new Date(s.filingDate) >= cutoff);
  }
  if (limit) results = results.slice(0, limit);
  return results;
}

async function getLatestPerCompany() {
  const signals = await loadSignals();
  const latest = {};
  for (const signal of signals) {
    if (!latest[signal.company]) latest[signal.company] = signal;
  }
  return Object.values(latest);
}

async function saveFeedItems(newItems) {
  const raw = await fs.readFile(FEED_FILE, "utf-8");
  const existing = JSON.parse(raw);
  const existingUrls = new Set(existing.map((i) => i.url));
  const fresh = newItems.filter((i) => i.url && !existingUrls.has(i.url));
  if (fresh.length === 0) {
    console.log("No new feed items to save");
    return { added: 0, total: existing.length };
  }
  const merged = [...fresh, ...existing]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 500);
  await fs.writeFile(FEED_FILE, JSON.stringify(merged, null, 2));
  console.log(`Saved ${fresh.length} new feed items (${merged.length} total)`);
  return { added: fresh.length, total: merged.length };
}

async function queryFeed({ company, type, limit = 20 } = {}) {
  const raw = await fs.readFile(FEED_FILE, "utf-8");
  let items = JSON.parse(raw);
  if (company) items = items.filter((i) => i.company === company);
  if (type) items = items.filter((i) => i.type === type);
  return items.slice(0, limit);
}

async function saveRollup(text) {
  const existing = await loadRollups();
  const entry = {
    generatedAt: new Date().toISOString(),
    month: currentMonthKey(),
    text,
  };
  const updated = [entry, ...existing.filter((r) => r.month !== entry.month)];
  await fs.writeFile(ROLLUP_FILE, JSON.stringify(updated, null, 2));
  console.log(`Rollup saved for ${entry.month}`);
  return entry;
}

async function loadRollups() {
  const raw = await fs.readFile(ROLLUP_FILE, "utf-8");
  return JSON.parse(raw);
}

async function getLatestRollup() {
  const rollups = await loadRollups();
  return rollups[0] ?? null;
}

async function updateMeta(signalCount) {
  const meta = { lastRun: new Date().toISOString(), totalSignals: signalCount };
  await fs.writeFile(META_FILE, JSON.stringify(meta, null, 2));
  return meta;
}

async function getMeta() {
  const raw = await fs.readFile(META_FILE, "utf-8");
  return JSON.parse(raw);
}

function dedupeKey(signal) {
  return `${signal.company}__${signal.filingType}__${signal.filingDate}__v2`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export {
  initStorage,
  saveSignals,
  loadSignals,
  querySignals,
  getLatestPerCompany,
  saveFeedItems,
  queryFeed,
  saveRollup,
  loadRollups,
  getLatestRollup,
  updateMeta,
  getMeta,
};
