import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "_",
  textNodeName: "value",
});

function buildGoogleNewsUrl(companyName) {
  const query = encodeURIComponent(`"${companyName}" fintech payments SMB`);
  return `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
}

const INDUSTRY_FEEDS = [
  { name: "Payments Dive", url: "https://www.paymentsdive.com/feeds/news/" },
  { name: "PYMNTS",        url: "https://www.pymnts.com/feed/" },
  { name: "SaaStr",        url: "https://www.saastr.com/feed/" },
  { name: "TechCrunch",    url: "https://techcrunch.com/category/fintech/feed/" },
];

const COMPANY_KEYWORDS = {
  "Bill.com":  ["bill.com", "bill.com holdings", "bill holdings"],
  "Intuit":    ["intuit", "quickbooks", "quickbooks online", "qbo", "quickbooks money"],
  "Ramp":      ["ramp", "ramp financial", "ramp.com"],
  "Plastiq":   ["plastiq"],
  "Nickel":    ["nickel", "nickel.com", "nickel financial"],
};

async function fetchFeed(feedUrl, sourceName) {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "OnTheLedger RSS Reader contact@ontheledger.io" },
  });
  if (!res.ok) throw new Error(`RSS fetch failed (${res.status}): ${feedUrl}`);
  const xml = await res.text();
  const parsed = parser.parse(xml);
  const channel = parsed?.rss?.channel ?? parsed?.feed;
  if (!channel) throw new Error(`Could not parse feed: ${feedUrl}`);
  const items = channel.item ?? channel.entry ?? [];
  const itemArray = Array.isArray(items) ? items : [items];
  return itemArray.map((item) => normalizeItem(item, sourceName));
}

function normalizeItem(item, sourceName) {
  const link = item.link?.value ?? item.link?._href ?? item.link ?? item.id ?? "";
  const rawDate = item.pubDate ?? item.published ?? item.updated ?? new Date().toISOString();
  return {
    title: item.title?.value ?? item.title ?? "Untitled",
    url: typeof link === "string" ? link.trim() : "",
    source: sourceName,
    date: new Date(rawDate).toISOString().split("T")[0],
    summary: stripHtml(
      item.description?.value ?? item.description ??
      item.summary?.value ?? item.summary ?? ""
    ).slice(0, 300),
    rawDate,
  };
}

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function matchCompany(item) {
  const searchText = `${item.title} ${item.summary}`.toLowerCase();
  for (const [company, keywords] of Object.entries(COMPANY_KEYWORDS)) {
    if (keywords.some((kw) => {
      const escaped = kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escaped}\\b`).test(searchText);
    })) return company;
  }
  return null;
}

function classifyType(item) {
  const text = `${item.title} ${item.source}`.toLowerCase();
  if (text.includes("earnings") || text.includes("quarterly")) return "earnings";
  if (text.includes("press release") || text.includes("business wire") || text.includes("pr newswire")) return "press";
  return "blog";
}

async function ingestRssFeeds(companies, daysSince = 30) {
  const allItems = [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysSince);

  for (const company of companies) {
    const feedUrl = company.rssFeed ?? buildGoogleNewsUrl(company.name);
    const sourceName = company.rssFeed ? company.name : "Google News";
    try {
      console.log(`Fetching RSS for ${company.name}...`);
      const items = await fetchFeed(feedUrl, sourceName);
      const matched = items
        .filter((item) => new Date(item.date) >= cutoff)
        .map((item) => ({ ...item, company: company.name, type: classifyType(item) }));
      console.log(`  Found ${matched.length} items`);
      allItems.push(...matched);
      await sleep(400);
    } catch (err) {
      console.error(`  RSS error for ${company.name}:`, err.message);
    }
  }

  for (const feed of INDUSTRY_FEEDS) {
    try {
      console.log(`Fetching industry feed: ${feed.name}...`);
      const items = await fetchFeed(feed.url, feed.name);
      const matched = items
        .filter((item) => new Date(item.date) >= cutoff)
        .map((item) => {
          const company = matchCompany(item);
          if (!company) return null;
          return { ...item, company, type: classifyType(item) };
        })
        .filter(Boolean);
      console.log(`  Matched ${matched.length} items`);
      allItems.push(...matched);
      await sleep(400);
    } catch (err) {
      console.error(`  Industry feed error (${feed.name}):`, err.message);
    }
  }

  return deduplicateItems(allItems);
}

function deduplicateItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { ingestRssFeeds };
