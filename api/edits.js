const { sql, authorized, readJsonBody } = require("./_db");

// Shared, per-property edit overlays — replaces the old localStorage overlay so a
// Save on one machine shows up for every teammate. GET is open (read-only); writes
// need the team edit password via `Authorization: Bearer <token>`.
module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      const rows = await sql`select property_id, data from property_edits`;
      const out = {};
      rows.forEach(r => { out[r.property_id] = r.data; });
      res.status(200).json(out);
      return;
    }

    const id = (req.query && req.query.id) || "";
    if (!id) { res.status(400).json({ error: "missing id" }); return; }
    if (!authorized(req)) { res.status(401).json({ error: "unauthorized" }); return; }

    if (req.method === "PUT") {
      const body = readJsonBody(req);
      await sql`
        insert into property_edits (property_id, data, updated_at)
        values (${id}, ${JSON.stringify(body)}::jsonb, now())
        on conflict (property_id) do update set data = excluded.data, updated_at = now()
      `;
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      await sql`delete from property_edits where property_id = ${id}`;
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
