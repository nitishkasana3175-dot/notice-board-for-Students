// Usage: node scripts/reset-password.js <username> <new-password>
// Set DATABASE_URL first to change a password in the production database.
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("../db");

(async () => {
  const [username, password] = process.argv.slice(2);
  if (!username || !password || password.length < 8) {
    console.error("Usage: node scripts/reset-password.js <username> <new-password (8+ chars)>");
    process.exit(1);
  }
  await db.init();
  const ok = await db.setPassword(username, await bcrypt.hash(password, 12));
  console.log(ok ? "Password updated for " + username : "User not found: " + username);
  if (db.close) await db.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
