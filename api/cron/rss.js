import { ingestRssFeeds } from "../../rss.js";
import { saveFeedItems, initStorage } from "../../storage.blob.js";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const companies = require("../../companies.json");

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (process.env.NODE_ENV === "production" &&
      req.headers["authorization"] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    await initStorage();
    const items = await ingestRssFeeds(companies, 30);
    const { added, total } = await saveFeedItems(items);
    return res.status(200).json({ ok: true, added, total });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
