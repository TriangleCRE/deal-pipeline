// Minimal local dev server. Mirrors Vercel's zero-config routing closely
// enough for local development: static files from the repo root, plus
// api/properties/index.js and api/properties/[id].js for the /api routes.
// Run with: DATABASE_URL=... PASSCODE=... npm run dev
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import propertiesHandler from "../api/properties/index.js";
import propertyByIdHandler from "../api/properties/[id].js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PORT || 3000;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function send(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveStatic(req, res, urlPath) {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.join(ROOT, rel);
  if (!filePath.startsWith(ROOT)) { send(res, 403, "Forbidden"); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { send(res, 404, "Not found"); return; }
    const ext = path.extname(filePath);
    send(res, 200, data, { "Content-Type": MIME[ext] || "application/octet-stream" });
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = "";
    req.on("data", (c) => (chunks += c));
    req.on("end", () => {
      if (!chunks) return resolve({});
      try { resolve(JSON.parse(chunks)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// Adapts Node's raw (req, res) to the small subset of the Vercel Node
// handler API our api/*.js files use (req.query, req.body, res.status().json()).
function wrapRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)); };
  return res;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  wrapRes(res);

  if (url.pathname === "/api/properties" ) {
    req.query = {};
    if (req.method === "POST") {
      try { req.body = await readJsonBody(req); }
      catch (e) { return send(res, 400, JSON.stringify({ error: "Invalid JSON body" }), { "Content-Type": "application/json" }); }
    }
    return propertiesHandler(req, res);
  }
  const idMatch = url.pathname.match(/^\/api\/properties\/([^/]+)$/);
  if (idMatch) {
    req.query = { id: decodeURIComponent(idMatch[1]) };
    return propertyByIdHandler(req, res);
  }

  return serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => console.log(`Dev server on http://localhost:${PORT}`));
