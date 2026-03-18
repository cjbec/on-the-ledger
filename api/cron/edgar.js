import { fetchRecentFilings, fetchFilingText } from "../../edgar.js";
import { extractAllSignals } from "../../extractor.js";
import { saveSignals, updateMeta, initStorage, loadSignals } from "../../storage.blob.js";
import companies from "../../companies.json" with { type: "json" };

export const config = { maxDuration: 30 };

const MAX_FILINGS_PER_RUN = 3; // ~8-10s each (fetch + Claude) → safe under 30s

export default async function handler(req, res) {
  if (process.env.NODE_ENV === "production" &&
      req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Optional ?company= filter — matches company name case-insensitively
  const companyFilter = req.query?.company?.toLowerCase() ?? null;

  const targets = companies.filter((c) => {
    if (!c.cik) return false; // skip private companies
    if (companyFilter) return c.name.toLowerCase().includes(companyFilter);
    return true;
  });

  if (targets.length === 0) {
    return res.status(400).json({ ok: false, error: `No matching company for filter: ${companyFilter}` });
  }

  try {
    await initStorage();

    // Load already-processed keys so we skip duplicates before calling Claude
    const existing = await loadSignals();
    const existingKeys = new Set(existing.map((s) => `${s.company}__${s.filingType}__${s.filingDate}`));

    const filings = [];
    for (const company of targets) {
      const recent = await fetchRecentFilings(company, 90);
      // Only take filings we haven't processed yet, newest first
      const fresh = recent.filter(
        (f) => !existingKeys.has(`${company.name}__${f.form}__${f.filingDate}`)
      );
      for (const filing of fresh.slice(0, MAX_FILINGS_PER_RUN)) {
        const rawText = await fetchFilingText(filing);
        filings.push({ ...filing, rawText, ingestedAt: new Date().toISOString() });
      }
    }

    if (filings.length === 0) {
      return res.status(200).json({ ok: true, added: 0, total: existing.length, skipped: "no new filings" });
    }

    const signals = await extractAllSignals(filings);
    const { added, total } = await saveSignals(signals);
    await updateMeta(total);

    return res.status(200).json({ ok: true, added, total, processed: filings.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
