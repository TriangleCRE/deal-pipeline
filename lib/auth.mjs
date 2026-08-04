// The whole app's privacy model: one shared passcode, a signed session
// cookie, and a single gate middleware every request passes through. No
// user accounts, no roles, no session store — the cookie is a signed,
// timestamped token; the signing key is derived from PASSCODE itself so
// there's exactly one secret to manage.
import crypto from "node:crypto";

const COOKIE_NAME = "tri_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — re-enter the passcode after this

function secret() {
  const passcode = process.env.PASSCODE;
  if (!passcode) throw new Error("PASSCODE env var is not set");
  return passcode;
}

function hmac(input) {
  return crypto.createHmac("sha256", secret()).update(input).digest("base64url");
}

// Fixed-length, timing-safe comparison of two arbitrary strings (hashes
// both first so length itself never leaks any information).
function safeEqual(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function checkPasscode(candidate) {
  return typeof candidate === "string" && candidate.length > 0 && safeEqual(candidate, secret());
}

export function makeSessionCookieValue() {
  const payload = String(Date.now());
  return `${payload}.${hmac(payload)}`;
}

export function isValidSessionCookie(value) {
  if (!value || typeof value !== "string" || !value.includes(".")) return false;
  const i = value.lastIndexOf(".");
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  if (!safeEqual(sig, hmac(payload))) return false;
  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) return false;
  return Date.now() - issuedAt < MAX_AGE_MS;
}

// --- tiny cookie helpers (no cookie-parser dependency needed) ---
export function parseCookies(header) {
  const out = {};
  (header || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

export function sessionCookieHeader(req, { clear = false } = {}) {
  const secureFlag = req.secure || req.headers["x-forwarded-proto"] === "https";
  const attrs = ["Path=/", "HttpOnly", "SameSite=Lax"];
  if (secureFlag) attrs.push("Secure");
  if (clear) {
    return `${COOKIE_NAME}=; ${attrs.join("; ")}; Max-Age=0`;
  }
  attrs.push(`Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`);
  return `${COOKIE_NAME}=${encodeURIComponent(makeSessionCookieValue())}; ${attrs.join("; ")}`;
}

export function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return isValidSessionCookie(cookies[COOKIE_NAME]);
}

// Paths that must work with no session at all: the login form itself,
// logging out, and robots.txt (so well-behaved crawlers can actually read
// the disallow rules — the passcode wall is what actually enforces
// privacy, robots.txt is politeness-only).
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout", "/robots.txt"]);

export function isPublicPath(path) {
  return PUBLIC_PATHS.has(path);
}

export function loginPage({ error = false } = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Sign in — Deal Pipeline</title>
<style>
  :root{--brand:#33a94d;--brand-dark:#2b6b39;--ink:#14140f;--ink-2:#52514e;--muted:#8a8880;
    --line:#e6e5df;--page:#f6f7f4;--surface:#fff;--bad-bg:#fbe8e8;--bad-ink:#9a2727}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--page);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink)}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:14px;
    box-shadow:0 1px 2px rgba(20,20,15,.05),0 8px 24px rgba(20,20,15,.06);
    padding:32px 30px;width:100%;max-width:360px}
  h1{font-size:19px;margin:0 0 4px;letter-spacing:-.01em}
  p.sub{color:var(--ink-2);font-size:13.5px;margin:0 0 22px}
  label{font-size:13px;font-weight:700;color:var(--ink-2);display:block;margin-bottom:6px}
  input{width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:9px;font-size:15px;font-family:inherit}
  button{width:100%;margin-top:16px;background:var(--brand);border:1px solid var(--brand);color:#fff;
    font-weight:700;font-size:14.5px;padding:11px;border-radius:10px;cursor:pointer}
  button:hover{background:var(--brand-dark);border-color:var(--brand-dark)}
  .err{background:var(--bad-bg);color:var(--bad-ink);font-size:13px;font-weight:600;
    border-radius:8px;padding:9px 12px;margin-bottom:16px}
  .foot{color:var(--muted);font-size:11.5px;text-align:center;margin-top:18px}
</style></head><body>
  <form class="card" method="POST" action="/api/login">
    <h1>Deal Pipeline</h1>
    <p class="sub">Triangle Investment Group — internal &amp; private.</p>
    ${error ? `<div class="err">Incorrect passcode.</div>` : ""}
    <label for="passcode">Passcode</label>
    <input id="passcode" name="passcode" type="password" autofocus autocomplete="current-password" required>
    <button type="submit">Sign in</button>
  </form>
  <div class="foot" style="margin-top:8px"></div>
</body></html>`;
}

// The one gate every request passes through. Mount it before any static
// file serving, page route, or API route.
export function authGate(req, res, next) {
  if (isPublicPath(req.path)) return next();
  if (isAuthenticated(req)) return next();

  if (req.path.startsWith("/api/")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(401).set("Content-Type", "text/html; charset=utf-8").send(loginPage({ error: false }));
}
