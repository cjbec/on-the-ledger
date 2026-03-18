import { put, list } from "@vercel/blob";

const KEYS = {
  signals: "data/signals.json",
  feed:    "data/feed.json",
  rollup:  "data/rollup.json",
  meta:    "data/meta.json",
};

async function readBlob(key) {
  try {
    const { blobs } = await list({ prefix: key });
    const match = blobs.find((b) => b.pathname === key);
    if (!match) return null;
    const res = await fetch(match.downloadUrl);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeBlob(key, data) {
  await put(key, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

async function initStorage() {
  const defaults = {
    [KEYS.signals]: [],
    [KEYS.feed]:    [],
    [KEYS.rollup]:  [],
    [KEYS.meta]:    { lastRun: null, totalSignals: 0 },
  };
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const existing = await readBlob(key);
    if (existing === null) {
      await writeBlob(key, defaultValue);
      console.log(`Initialized blob: ${key}`);
    }
  }
  console.log("Blob storage ready");
}

async function loadSignals() {
  return (await readBlob(KEYS.signals)) ?? [];
}

async function saveSignals(newSignals) {
  const existing = await loadSignals();
  const existingKeys = new Set(existing.map(dedupeKey));
  const fresh = newSignals.filter((s) => !existingKeys.has(dedupeKey(s)));
  if (fresh.length === 0) return { added: 0, total: existing.length };
  const merged = [...existing, ...fresh].sort(
    (a, b) => new Date(b.filingDate) - new Date(a.filingDate)
  );
  await writeBlob(KEYS.signals, merged);
  return { added: fresh.length, total: merged.length };
}

async function querySignals({ company, filingType, since, limit } = {}) {
  let results = await loadSignals();
  if (company) results = results.filter((s) => s.company.toLowerCase() === company.toLowerCase());
  if (filingType) results = results.filter((s) => s.filingType === filingType);
  if (since) results = results.filter((s) => new Date(s.filingDate) >= new Date(since));
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
  const existing = (await readBlob(KEYS.feed)) ?? [];
  const existingUrls = new Set(existing.map((i) => i.url));
  const fresh = newItems.filter((i) => i.url && !existingUrls.has(i.url));
  if (fresh.length === 0) return { added: 0, total: existing.length };
  const merged = [...fresh, ...existing]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 500);
  await writeBlob(KEYS.feed, merged);
  return { added: fresh.length, total: merged.length };
}

async function queryFeed({ company, type, limit = 20 } = {}) {
  let items = (await readBlob(KEYS.feed)) ?? [];
  if (company) items = items.filter((i) => i.company === company);
  if (type) items = items.filter((i) => i.type === type);
  return items.slice(0, limit);
}

async function saveRollup(text) {
  const existing = (await readBlob(KEYS.rollup)) ?? [];
  const entry = { generatedAt: new Date().toISOString(), month: currentMonthKey(), text };
  const updated = [entry, ...existing.filter((r) => r.month !== entry.month)];
  await writeBlob(KEYS.rollup, updated);
  return entry;
}

async function loadRollups() {
  return (await readBlob(KEYS.rollup)) ?? [];
}

async function getLatestRollup() {
  const rollups = await loadRollups();
  return rollups[0] ?? null;
}

async function updateMeta(signalCount) {
  const meta = { lastRun: new Date().toISOString(), totalSignals: signalCount };
  await writeBlob(KEYS.meta, meta);
  return meta;
}

async function getMeta() {
  return (await readBlob(KEYS.meta)) ?? { lastRun: null, totalSignals: 0 };
}

function dedupeKey(signal) {
  return `${signal.company}__${signal.filingType}__${signal.filingDate}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export {
  initStorage, saveSignals, loadSignals, querySignals, getLatestPerCompany,
  saveFeedItems, queryFeed, saveRollup, loadRollups, getLatestRollup,
  updateMeta, getMeta,
};
