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
  // Mirrors the brand tokens + card language the rest of the app (property
  // cards, the brand lockup in the topbar) uses — see index.html's :root
  // custom properties — so the passcode wall doesn't look like a bolted-on
  // afterthought.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Sign in — Deal Pipeline</title>
<style>
  :root{--brand:#33a94d;--brand-dark:#2b6b39;--ink:#14140f;--ink-2:#52514e;--muted:#8a8880;
    --line:#e6e5df;--page:#f6f7f4;--surface:#fff;--bad-bg:#fbe8e8;--bad-ink:#9a2727;
    --radius:16px;--shadow:0 1px 2px rgba(20,20,15,.05),0 8px 24px rgba(20,20,15,.06)}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--page);
    font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);padding:24px}
  .shell{width:100%;max-width:480px;background:var(--surface);border:1px solid var(--line);
    border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden}
  .accent{height:6px;background:var(--brand)}
  form{padding:34px 36px 36px}
  .brandrow{display:flex;align-items:center;gap:10px}
  .tri{width:15px;height:20px;flex:none;background:var(--brand);
    clip-path:polygon(0 0,100% 100%,0 100%)}
  .name{font-weight:800;font-size:23px;letter-spacing:-.01em;color:var(--ink)}
  .sub{color:var(--muted);font-size:13px;font-weight:700;letter-spacing:.08em;
    text-transform:uppercase;margin:8px 0 26px}
  label{font-size:14px;font-weight:700;color:var(--ink);display:block;margin-bottom:8px}
  input{width:100%;padding:15px 16px;border:2px solid var(--brand);border-radius:10px;
    font-size:16px;font-family:inherit;outline:none}
  input:focus{border-color:var(--brand-dark)}
  button{width:100%;margin-top:20px;background:var(--brand-dark);border:1px solid var(--brand-dark);
    color:#fff;font-weight:700;font-size:16px;padding:15px;border-radius:10px;cursor:pointer}
  button:hover{background:#1f4e29;border-color:#1f4e29}
  .err{background:var(--bad-bg);color:var(--bad-ink);font-size:13px;font-weight:600;
    border-radius:8px;padding:9px 12px;margin:0 0 18px}
</style></head><body>
  <div class="shell">
    <div class="accent"></div>
    <form method="POST" action="/api/login">
      <div class="brandrow"><span class="tri"></span><span class="name">TRIANGLE</span></div>
      <div class="sub">Investment Group &middot; Deal Pipeline</div>
      ${error ? `<div class="err">Incorrect passcode.</div>` : ""}
      <label for="passcode">Passcode</label>
      <input id="passcode" name="passcode" type="password" autofocus autocomplete="current-password" required>
      <button type="submit">Enter</button>
    </form>
  </div>
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
