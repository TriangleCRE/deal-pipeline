// Triangle Deal Pipeline — the whole backend.
//
// One small Express app, deployed as a single Vercel serverless function
// (see vercel.json) so every request — static files, the SPA shell, the
// API, even 404s — passes through the SAME two pieces of middleware:
//   1. X-Robots-Tag, on every single response, no exceptions.
//   2. The session-cookie auth gate — the passcode wall that actually
//      keeps this private (robots.txt / noindex are politeness only).
//
// No ORM, no admin panel, no background jobs, no extra tables. This file
// plus routes/properties.js plus lib/{db,auth}.mjs is the entire backend.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { authGate, checkPasscode, sessionCookieHeader, loginPage } from "./lib/auth.mjs";
import propertiesRouter from "./routes/properties.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1); // Vercel (and most hosts) sit behind a proxy — needed for req.secure

/* ---------- 1. noindex on literally every response ---------- */
app.use((req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  next();
});

/* ---------- robots.txt (public — see lib/auth.mjs PUBLIC_PATHS) ----------
   Politeness layer only. Disallows everything for every crawler, with
   explicit named entries for the well-known AI scrapers. The passcode
   wall below is what actually enforces privacy. */
const ROBOTS_TXT = `User-agent: *
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: Bytespider
Disallow: /
`;
app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(ROBOTS_TXT);
});

/* ---------- login / logout (public) ---------- */
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/login", (req, res) => {
  res.status(200).set("Content-Type", "text/html; charset=utf-8").send(loginPage({ error: false }));
});

app.post("/api/login", (req, res) => {
  const passcode = (req.body && req.body.passcode) || "";
  if (!checkPasscode(passcode)) {
    res.status(401).set("Content-Type", "text/html; charset=utf-8").send(loginPage({ error: true }));
    return;
  }
  res.setHeader("Set-Cookie", sessionCookieHeader(req));
  res.redirect(302, "/");
});

app.all("/api/logout", (req, res) => {
  res.setHeader("Set-Cookie", sessionCookieHeader(req, { clear: true }));
  res.redirect(302, "/login");
});

/* ---------- 2. the passcode wall — everything below requires a session ---------- */
app.use(authGate);

app.use("/api/properties", propertiesRouter);
app.use("/uploads", express.static(path.join(ROOT, "uploads")));
app.use("/prompt", express.static(path.join(ROOT, "prompt")));

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

// Clean up any error response (e.g. malformed request bodies) instead of
// leaking a stack trace — X-Robots-Tag is already set from the first
// middleware above, so it's still on this response too.
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 400;
  if (req.path.startsWith("/api/")) {
    res.status(status).json({ error: "Bad request" });
  } else {
    res.status(status).type("text/plain").send("Bad request");
  }
});

export default app;
