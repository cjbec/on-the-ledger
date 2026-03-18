function buildSystemPrompt(focus) {
  const focusClause = focus
    ? `\n\nIMPORTANT SCOPE RESTRICTION: ${focus}`
    : "";
  return `You are a Customer Success intelligence analyst specializing in SaaS and fintech companies.

You will be given raw text from a financial filing (10-K, 10-Q, or 8-K). Your job is to extract signals relevant to Customer Success leaders and practitioners.

Extract the following:
- Net Revenue Retention (NRR) or Net Dollar Retention (NDR) — exact percentages if stated
- Gross Revenue Retention (GRR) — exact percentages if stated
- Customer count or logo count changes
- Churn or downsell language — direct mentions or euphemisms like "contraction", "downgrades", "non-renewals"
- Expansion revenue commentary — upsells, cross-sells, seat expansion
- Customer health, satisfaction, or sentiment signals
- CS team investment — headcount, tooling, organizational changes
- Forward-looking guidance related to retention, growth, or customer outcomes
- Earnings highlights — revenue, growth rate, and any metric a CS leader would cite to understand business health
- Product roadmap — new features, launches, or platform investments mentioned that affect the customer experience${focusClause}

Rules:
- Return valid JSON only. No preamble, no markdown, no backticks.
- Use null for any field where no signal is present — do not guess or infer.
- For nrr, grr, and churn_rate use numeric string format e.g. "104.5%" or null.
- For earnings_highlights: 1-2 sentences max covering revenue and growth context.
- For product_roadmap: 1-2 sentences max on customer-facing product investments or launches.
- Keep summary under 60 words and written for a CS practitioner audience.
- If the document contains no relevant signals at all, return { "no_signal": true }.`;
}

async function extractSignals(filing) {
  const systemPrompt = buildSystemPrompt(filing.focus);
  const userPrompt = `Company: ${filing.company}
Filing Type: ${filing.form}
Filing Date: ${filing.filingDate}
${filing.focus ? `Focus Area: ${filing.focus}` : ""}

--- BEGIN FILING TEXT ---
${filing.rawText}
--- END FILING TEXT ---

Extract all Customer Success signals from this filing and return as JSON.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${errBody.error?.message ?? JSON.stringify(errBody)}`);
  }
  const data = await response.json();
  const rawText = data.content.map((b) => b.text || "").join("").trim();

  let signals;
  try {
    signals = JSON.parse(rawText);
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${rawText}`);
  }

  if (signals.no_signal) {
    console.log(`  No CS signals found in ${filing.company} ${filing.form}`);
    return null;
  }

  return {
    company: filing.company,
    ticker: filing.ticker,
    focus: filing.focus ?? null,
    filingType: filing.form,
    filingDate: filing.filingDate,
    extractedAt: new Date().toISOString(),
    signals: {
      nrr: signals.nrr ?? null,
      grr: signals.grr ?? null,
      customerCount: signals.customer_count ?? null,
      churnRate: signals.churn_rate ?? null,
      churnSignal: signals.churn_signal ?? null,
      expansionSignal: signals.expansion_signal ?? null,
      csInvestment: signals.cs_investment ?? null,
      customerHealth: signals.customer_health ?? null,
      guidance: signals.guidance ?? null,
      earningsHighlights: signals.earnings_highlights ?? null,
      productRoadmap: signals.product_roadmap ?? null,
      summary: signals.summary ?? null,
    },
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.cik}&type=${filing.form}`,
  };
}

async function extractAllSignals(filings) {
  const results = [];
  for (const filing of filings) {
    try {
      console.log(`Extracting: ${filing.company} ${filing.form} (${filing.filingDate})`);
      const signal = await extractSignals(filing);
      if (signal) {
        results.push(signal);
        console.log(`  ✓ NRR: ${signal.signals.nrr ?? "not disclosed"}`);
      }
      await sleep(300);
    } catch (err) {
      console.error(`  ✗ Failed for ${filing.company}:`, err.message);
    }
  }
  return results;
}

async function generateBenchmarkRollup(signals) {
  const signalSummaries = signals
    .filter((s) => s.signals.summary)
    .map((s) => {
      const focusNote = s.focus ? ` [Focus: ${s.focus.split("—")[0].trim()}]` : "";
      return `${s.company}${focusNote} (${s.filingType}, ${s.filingDate}): ${s.signals.summary}`;
    })
    .join("\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: `You are a Customer Success strategist writing a monthly market intelligence briefing focused on fintech and SMB SaaS companies — specifically B2B payments, spend management, and small business financial tooling. Write in a clear, direct tone for CS leaders. No bullet points — flowing prose only. Under 150 words.`,
      messages: [{
        role: "user",
        content: `Based on these recent signals, write a monthly CS market benchmark summary:\n\n${signalSummaries}`,
      }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${errBody.error?.message ?? JSON.stringify(errBody)}`);
  }
  const data = await response.json();
  return data.content.map((b) => b.text || "").join("").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { extractSignals, extractAllSignals, generateBenchmarkRollup };
