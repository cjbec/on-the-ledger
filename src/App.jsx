import { useState, useEffect } from "react";

const COMPANIES = ["Bill.com", "Intuit", "Ramp", "Plastiq", "Nickel"];

const COLORS = {
  "Bill.com": "#2563eb",
  "Intuit":   "#00a86b",
  "Ramp":     "#f59e0b",
  "Plastiq":  "#8b5cf6",
  "Nickel":   "#ef4444",
};

function Badge({ value, color }) {
  if (!value) return <span style={{ color: "#9ca3af", fontSize: 13 }}>—</span>;
  return (
    <span style={{
      background: color + "22",
      color,
      borderRadius: 6,
      padding: "2px 8px",
      fontWeight: 700,
      fontSize: 13,
    }}>{value}</span>
  );
}

function SignalCard({ signal }) {
  const color = COLORS[signal.company] ?? "#6b7280";
  const s = signal.signals;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 12,
      padding: "18px 22px",
      marginBottom: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          background: color,
          color: "#fff",
          borderRadius: 6,
          padding: "2px 10px",
          fontWeight: 700,
          fontSize: 13,
        }}>{signal.company}</span>
        <span style={{ color: "#6b7280", fontSize: 13 }}>{signal.filingType} · {signal.filingDate}</span>
        {signal.ticker && (
          <span style={{ color: "#9ca3af", fontSize: 12, marginLeft: "auto" }}>${signal.ticker}</span>
        )}
      </div>
      {s.summary && (
        <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.5 }}>{s.summary}</p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {s.nrr && <div><span style={{ color: "#6b7280", fontSize: 12 }}>NRR </span><Badge value={s.nrr} color={color} /></div>}
        {s.grr && <div><span style={{ color: "#6b7280", fontSize: 12 }}>GRR </span><Badge value={s.grr} color={color} /></div>}
        {s.churnRate && <div><span style={{ color: "#6b7280", fontSize: 12 }}>Churn </span><Badge value={s.churnRate} color="#ef4444" /></div>}
        {s.customerCount && <div><span style={{ color: "#6b7280", fontSize: 12 }}>Customers </span><Badge value={s.customerCount} color={color} /></div>}
      </div>
      {(s.earningsHighlights || s.productRoadmap) && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
          {s.earningsHighlights && <p style={{ margin: 0, fontSize: 13, color: "#374151" }}><strong>Earnings:</strong> {s.earningsHighlights}</p>}
          {s.productRoadmap && <p style={{ margin: 0, fontSize: 13, color: "#374151" }}><strong>Product:</strong> {s.productRoadmap}</p>}
        </div>
      )}
      {(s.churnSignal || s.expansionSignal || s.csInvestment || s.guidance) && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {s.churnSignal && <p style={{ margin: 0, fontSize: 13, color: "#374151" }}><strong>Churn:</strong> {s.churnSignal}</p>}
          {s.expansionSignal && <p style={{ margin: 0, fontSize: 13, color: "#374151" }}><strong>Expansion:</strong> {s.expansionSignal}</p>}
          {s.csInvestment && <p style={{ margin: 0, fontSize: 13, color: "#374151" }}><strong>CS Investment:</strong> {s.csInvestment}</p>}
          {s.guidance && <p style={{ margin: 0, fontSize: 13, color: "#374151" }}><strong>Guidance:</strong> {s.guidance}</p>}
        </div>
      )}
      <div style={{ marginTop: 10 }}>
        <a href={signal.sourceUrl} target="_blank" rel="noreferrer"
           style={{ fontSize: 12, color: "#6b7280", textDecoration: "none" }}>
          View filing →
        </a>
      </div>
    </div>
  );
}

function FeedItem({ item }) {
  const color = COLORS[item.company] ?? "#6b7280";
  return (
    <div style={{
      padding: "12px 0",
      borderBottom: "1px solid #f3f4f6",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />
        <span style={{ color: "#6b7280", fontSize: 12 }}>{item.company} · {item.source} · {item.date}</span>
      </div>
      <a href={item.url} target="_blank" rel="noreferrer"
         style={{ fontSize: 14, color: "#111827", fontWeight: 500, textDecoration: "none", lineHeight: 1.4 }}>
        {item.title}
      </a>
      {item.summary && (
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>{item.summary}</p>
      )}
    </div>
  );
}

export default function App() {
  const [signals, setSignals] = useState([]);
  const [feed, setFeed] = useState([]);
  const [rollup, setRollup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCompany, setActiveCompany] = useState(null);
  const [activeTab, setActiveTab] = useState("signals");

  useEffect(() => {
    async function load() {
      try {
        const [sigRes, feedRes, rollupRes] = await Promise.all([
          fetch("/api/data/signals"),
          fetch("/api/data/feed?limit=50"),
          fetch("/api/data/rollup"),
        ]);
        const [sigData, feedData, rollupData] = await Promise.all([
          sigRes.json(),
          feedRes.json(),
          rollupRes.json(),
        ]);
        setSignals(Array.isArray(sigData) ? sigData : []);
        setFeed(Array.isArray(feedData) ? feedData : []);
        setRollup(rollupData?.text ?? null);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredSignals = activeCompany
    ? signals.filter((s) => s.company === activeCompany)
    : signals;

  const filteredFeed = activeCompany
    ? feed.filter((f) => f.company === activeCompany)
    : feed;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#111827", color: "#fff", padding: "20px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>On The Ledger</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>
              Fintech CS intelligence — Bill.com · Intuit · Ramp · Plastiq · Nickel
            </p>
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
            {signals.length} signals · {feed.length} news items
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 32px" }}>
        {/* Rollup banner */}
        {rollup && (
          <div style={{
            background: "#1e293b",
            color: "#e2e8f0",
            borderRadius: 12,
            padding: "18px 22px",
            marginBottom: 24,
            fontSize: 14,
            lineHeight: 1.6,
          }}>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
              Monthly Benchmark Summary
            </div>
            {rollup}
          </div>
        )}

        {/* Company filter */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveCompany(null)}
            style={{
              padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
              background: !activeCompany ? "#111827" : "#e5e7eb",
              color: !activeCompany ? "#fff" : "#374151",
              fontWeight: 600, fontSize: 13,
            }}
          >All</button>
          {COMPANIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCompany(activeCompany === c ? null : c)}
              style={{
                padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer",
                background: activeCompany === c ? COLORS[c] : "#e5e7eb",
                color: activeCompany === c ? "#fff" : "#374151",
                fontWeight: 600, fontSize: 13,
              }}
            >{c}</button>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
          {["signals", "news"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px", border: "none", cursor: "pointer", background: "none",
                fontWeight: 600, fontSize: 14, textTransform: "capitalize",
                color: activeTab === tab ? "#111827" : "#9ca3af",
                borderBottom: activeTab === tab ? "2px solid #111827" : "2px solid transparent",
                marginBottom: -2,
              }}
            >{tab === "signals" ? `Signals (${filteredSignals.length})` : `News (${filteredFeed.length})`}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Loading…</div>
        ) : activeTab === "signals" ? (
          filteredSignals.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              No signals yet. Run <code>npm run edgar</code> to ingest filings.
            </div>
          ) : (
            filteredSignals.map((s, i) => <SignalCard key={i} signal={s} />)
          )
        ) : (
          filteredFeed.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              No news items yet. Run <code>npm run rss</code> to ingest feeds.
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "4px 22px" }}>
              {filteredFeed.map((item, i) => <FeedItem key={i} item={item} />)}
            </div>
          )
        )}
      </div>
    </div>
  );
}
