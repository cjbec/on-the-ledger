import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { readFile } from "fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inline dev API — serves ./data/*.json directly so no separate server needed
function devApiPlugin() {
  return {
    name: "dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");

        if (!url.pathname.startsWith("/api/data/")) return next();

        const send = (data) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };

        try {
          const route = url.pathname.replace("/api/data/", "");

          if (route === "signals") {
            const raw = await readFile(`${__dirname}/data/signals.json`, "utf-8");
            const all = JSON.parse(raw);
            const { company, type, view } = Object.fromEntries(url.searchParams);
            if (view === "latest") {
              const latest = {};
              for (const s of all) if (!latest[s.company]) latest[s.company] = s;
              return send(Object.values(latest));
            }
            let results = all;
            if (company) results = results.filter(s => s.company.toLowerCase() === company.toLowerCase());
            if (type) results = results.filter(s => s.filingType === type);
            return send(results.slice(0, 50));
          }

          if (route === "feed") {
            const raw = await readFile(`${__dirname}/data/feed.json`, "utf-8");
            let items = JSON.parse(raw);
            const { company, type, limit } = Object.fromEntries(url.searchParams);
            if (company) items = items.filter(i => i.company === company);
            if (type) items = items.filter(i => i.type === type);
            return send(items.slice(0, limit ? parseInt(limit) : 20));
          }

          if (route === "rollup") {
            const raw = await readFile(`${__dirname}/data/rollup.json`, "utf-8");
            const rollups = JSON.parse(raw);
            return send(rollups[0] ?? { text: null });
          }

          next();
        } catch {
          send({ error: "data not found" });
        }
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), devApiPlugin()],
});
