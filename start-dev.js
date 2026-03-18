#!/usr/bin/env node
// Changes CWD to the project directory before starting Vite
import { dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { chdir } from "process";

const __dirname = dirname(fileURLToPath(import.meta.url));
chdir(__dirname);

// Now import and run vite's CLI from the correct CWD
const viteCliPath = pathToFileURL(`${__dirname}/node_modules/vite/bin/vite.js`).href;
await import(viteCliPath);
