// Shared-passcode guard for write endpoints. Deliberately dumb: one secret
// in an env var, typed once into the UI and sent back on every write. No
// sessions, no users, no admin panel — this is an internal tool.
export function checkPasscode(req) {
  const expected = process.env.PASSCODE;
  if (!expected) {
    // Fail closed: if the operator hasn't set a passcode, writes are refused
    // rather than silently left open.
    return { ok: false, status: 500, message: "Server is missing the PASSCODE env var." };
  }
  const supplied = req.headers["x-passcode"] || "";
  if (supplied !== expected) {
    return { ok: false, status: 401, message: "Incorrect passcode." };
  }
  return { ok: true };
}
