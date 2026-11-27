// Storage layer.
//  - Production (Render): PostgreSQL via DATABASE_URL  -> persistent
//  - Local development  : JSON files in /data          -> convenient, NOT for production
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const NOTICES_FILE = path.join(DATA_DIR, "notices.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  return raw.trim() === "" ? [] : JSON.parse(raw);
}
function writeJson(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

// ---------------- JSON backend (local dev) ----------------
function jsonStore() {
  return {
    kind: "json",
    async init() {},
    async countNotices() { return readJson(NOTICES_FILE).length; },
    async listNotices(department) {
      let n = readJson(NOTICES_FILE);
      if (department && department !== "All") n = n.filter((x) => x.department === department);
      return n.sort((a, b) => b.date.localeCompare(a.date));
    },
    async createNotice(n) {
      const all = readJson(NOTICES_FILE);
      const notice = { id: newId(), ...n };
      all.push(notice);
      writeJson(NOTICES_FILE, all);
      return notice;
    },
    async importNotices(list) { writeJson(NOTICES_FILE, list); },
    async deleteNotice(id) {
      const all = readJson(NOTICES_FILE);
      const i = all.findIndex((x) => x.id === id);
      if (i === -1) return null;
      const [removed] = all.splice(i, 1);
      writeJson(NOTICES_FILE, all);
      return removed;
    },
    async findUserByLogin(login) {
      const l = login.toLowerCase();
      return readJson(USERS_FILE).find((u) => u.username.toLowerCase() === l || u.email.toLowerCase() === l) || null;
    },
    async findUserById(id) { return readJson(USERS_FILE).find((u) => u.id === id) || null; },
    async createUser(u) {
      const all = readJson(USERS_FILE);
      const user = { id: newId(), ...u };
      all.push(user);
      writeJson(USERS_FILE, all);
      return user;
    },
    async setPassword(username, hash) {
      const all = readJson(USERS_FILE);
      const u = all.find((x) => x.username.toLowerCase() === username.toLowerCase());
      if (!u) return false;
      u.password_hash = hash;
      writeJson(USERS_FILE, all);
      return true;
    },
  };
}

// ---------------- PostgreSQL backend (production) ----------------
function pgStore(databaseUrl) {
  const { Pool } = require("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(databaseUrl);
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false }, // Render Postgres requires SSL
  });
  const q = (text, params) => pool.query(text, params);
  const toNotice = (r) => r && ({
    id: r.id, title: r.title, description: r.description,
    department: r.department, date: r.date, createdBy: r.created_by,
  });

  return {
    kind: "postgres",
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('admin','faculty','student')),
        password_hash TEXT NOT NULL
      )`);
      await q(`CREATE TABLE IF NOT EXISTS notices (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        department TEXT NOT NULL,
        date TEXT NOT NULL,
        created_by TEXT
      )`);
    },
    async countNotices() { return Number((await q("SELECT COUNT(*) FROM notices")).rows[0].count); },
    async listNotices(department) {
      const r = department && department !== "All"
        ? await q("SELECT * FROM notices WHERE department=$1 ORDER BY date DESC, id DESC", [department])
        : await q("SELECT * FROM notices ORDER BY date DESC, id DESC");
      return r.rows.map(toNotice);
    },
    async createNotice(n) {
      const id = newId();
      await q("INSERT INTO notices (id,title,description,department,date,created_by) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, n.title, n.description, n.department, n.date, n.createdBy || null]);
      return { id, ...n };
    },
    async importNotices(list) {
      for (const n of list) {
        await q("INSERT INTO notices (id,title,description,department,date,created_by) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING",
          [n.id || newId(), n.title, n.description, n.department, n.date, n.createdBy || null]);
      }
    },
    async deleteNotice(id) {
      const r = await q("DELETE FROM notices WHERE id=$1 RETURNING *", [id]);
      return toNotice(r.rows[0]) || null;
    },
    async findUserByLogin(login) {
      return (await q("SELECT * FROM users WHERE lower(username)=lower($1) OR lower(email)=lower($1)", [login])).rows[0] || null;
    },
    async findUserById(id) { return (await q("SELECT * FROM users WHERE id=$1", [id])).rows[0] || null; },
    async createUser(u) {
      const id = newId();
      await q("INSERT INTO users (id,name,username,email,role,password_hash) VALUES ($1,$2,$3,$4,$5,$6)",
        [id, u.name, u.username, u.email, u.role, u.password_hash]);
      return { id, ...u };
    },
    async setPassword(username, hash) {
      const r = await q("UPDATE users SET password_hash=$1 WHERE lower(username)=lower($2)", [hash, username]);
      return r.rowCount > 0;
    },
    async close() { await pool.end(); },
  };
}

module.exports = process.env.DATABASE_URL ? pgStore(process.env.DATABASE_URL) : jsonStore();
