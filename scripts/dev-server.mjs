// Local dev server — boots the exact same Express app that Vercel runs
// (server.js), so local behavior matches production, including the
// passcode gate, X-Robots-Tag, and robots.txt.
// Run with: DATABASE_URL=... PASSCODE=... npm run dev
import app from "../server.js";

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dev server on http://localhost:${PORT}`));
