const EDGAR_BASE = "https://data.sec.gov/submissions";
const TARGET_FILINGS = ["10-K", "10-Q", "8-K"];

const HEADERS = {
  "User-Agent": "OnTheLedger contact@ontheledger.io",
  "Accept-Encoding": "gzip, deflate",
};

async function fetchRecentFilings(company, daysSince = 90) {
  const paddedCik = company.cik.padStart(10, "0");
  const url = `${EDGAR_BASE}/CIK${paddedCik}.json`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`EDGAR fetch failed for ${company.name}: ${res.status}`);
  const data = await res.json();
  const filings = data.filings.recent;
  const normalized = filings.form.map((form, i) => ({
    company: company.name,
    ticker: company.ticker,
    cik: company.cik,
    focus: company.focus ?? null,
    form,
    filingDate: filings.filingDate[i],
    accessionNumber: filings.accessionNumber[i],
    primaryDocument: filings.primaryDocument[i],
    processed: false,
  }));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysSince);
  return normalized.filter(
    (f) => TARGET_FILINGS.includes(f.form) && new Date(f.filingDate) >= cutoff
  );
}

function buildFilingUrl(filing) {
  const accession = filing.accessionNumber.replace(/-/g, "");
  const cik = String(parseInt(filing.cik, 10)); // strip leading zeros for path
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${filing.primaryDocument}`;
}

async function fetchFilingText(filing, maxChars = 20000) {
  const url = buildFilingUrl(filing);
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Failed to fetch filing doc: ${url}`);
  const html = await res.text();
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 20000);
}

async function ingestAllCompanies(companies, daysSince = 90) {
  const results = [];
  for (const company of companies) {
    if (!company.cik) {
      console.log(`Skipping ${company.name} — private company, no CIK`);
      continue;
    }
    try {
      console.log(`Fetching filings for ${company.name}...`);
      const filings = await fetchRecentFilings(company, daysSince);
      console.log(`  Found ${filings.length} relevant filings`);
      for (const filing of filings) {
        const rawText = await fetchFilingText(filing);
        results.push({ ...filing, rawText, ingestedAt: new Date().toISOString() });
        await sleep(500);
      }
    } catch (err) {
      console.error(`Error ingesting ${company.name}:`, err.message);
    }
  }
  return results;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { ingestAllCompanies, fetchRecentFilings, fetchFilingText, buildFilingUrl };
