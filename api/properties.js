const { sql, authorized, readJsonBody } = require("./_db");

// Brand-new properties published from the Add Property form — kept separate from the
// hardcoded TRIANGLE_PROPERTIES array in index.html so publishing needs no commit/deploy.
// GET is open (read-only); POST needs the team edit password.
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const rows = await sql`select data from new_properties order by created_at asc`;
      res.status(200).json(rows.map(r => r.data));
      return;
    }

    if (req.method === "POST") {
      if (!authorized(req)) { res.status(401).json({ error: "unauthorized" }); return; }
      const body = readJsonBody(req);
      if (!body || !body.id) { res.status(400).json({ error: "missing id" }); return; }
      await sql`
        insert into new_properties (id, data, updated_at)
        values (${body.id}, ${JSON.stringify(body)}::jsonb, now())
        on conflict (id) do update set data = excluded.data, updated_at = now()
      `;
      res.status(200).json({ ok: true, id: body.id });
      return;
    }

    res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
