const { neon } = require("@neondatabase/serverless");

const sql = neon(process.env.DATABASE_URL);

function authorized(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return !!process.env.EDIT_TOKEN && token === process.env.EDIT_TOKEN;
}

function readJsonBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8") || "{}");
  return req.body;
}

module.exports = { sql, authorized, readJsonBody };
