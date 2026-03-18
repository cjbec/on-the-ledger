/**
 * Local dev API server — mirrors Vercel serverless functions.
 * Run alongside `npm run dev` (Vite proxies /api/* here on port 3001).
 */
import { createServer } from "http";
import { readFile } from "fs/promises";
import { querySignals, getLatestPerCompany, queryFeed, getLatestRollup } from "./storage.js";

const PORT = 3001;

function parseQuery(url) {
  const u = new URL(url, "http://localhost");
  const params = {};
  u.searchParams.forEach((v, k) => { params[k] = v; });
  return params;
}

async function route(req, res) {
  const url = req.url.split("?")[0];
  const query = parseQuery(req.url);

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    if (url === "/api/data/signals") {
      const data = query.view === "latest"
        ? await getLatestPerCompany()
        : await querySignals({ company: query.company, filingType: query.type, limit: 50 });
      res.writeHead(200);
      return res.end(JSON.stringify(data));
    }

    if (url === "/api/data/feed") {
      const data = await queryFeed({
        company: query.company,
        type: query.type,
        limit: query.limit ? parseInt(query.limit) : 20,
      });
      res.writeHead(200);
      return res.end(JSON.stringify(data));
    }

    if (url === "/api/data/rollup") {
      const data = await getLatestRollup();
      res.writeHead(200);
      return res.end(JSON.stringify(data ?? { text: null }));
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
}

createServer(route).listen(PORT, () => {
  console.log(`Local API server running on http://localhost:${PORT}`);
});
