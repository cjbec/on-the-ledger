import { generateBenchmarkRollup } from "../../extractor.js";
import { getLatestPerCompany, saveRollup, initStorage } from "../../storage.blob.js";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (process.env.NODE_ENV === "production" &&
      req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await initStorage();
    const latest = await getLatestPerCompany();
    if (latest.length === 0) return res.status(200).json({ ok: true, skipped: true });
    const text = await generateBenchmarkRollup(latest);
    await saveRollup(text);
    return res.status(200).json({ ok: true, month: new Date().toISOString().slice(0, 7) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
