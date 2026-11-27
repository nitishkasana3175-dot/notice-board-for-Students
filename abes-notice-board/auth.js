// Authentication + role-based authorization (JWT in an httpOnly cookie)
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("./db");

const COOKIE = "abes_token";
const MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours
const ROLES = ["admin", "faculty", "student"];
const isProd = process.env.NODE_ENV === "production";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    if (isProd) throw new Error("JWT_SECRET must be set (32+ characters) in production.");
    return "dev-only-insecure-secret-change-me-please-0000";
  }
  return s;
}

function cookieOptions() {
  return { httpOnly: true, sameSite: "lax", secure: isProd, maxAge: MAX_AGE_MS, path: "/" };
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

function publicUser(u) {
  return { id: u.id, name: u.name, username: u.username, email: u.email, role: u.role };
}

function issueToken(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, secret(), { expiresIn: "8h" });
  res.cookie(COOKIE, token, cookieOptions());
}

function clearToken(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/" });
}

// Loads the user from the cookie (re-checked against the DB every request). Sets req.user or null.
async function loadUser(req, res, next) {
  req.user = null;
  const token = parseCookies(req)[COOKIE];
  if (token) {
    try {
      const payload = jwt.verify(token, secret());
      const user = await db.findUserById(payload.sub);
      if (user) req.user = publicUser(user);
    } catch (e) { /* invalid / expired token -> treated as logged out */ }
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Please log in to continue." });
  next();
}

function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Please log in to continue." });
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: "Your role (" + req.user.role + ") is not allowed to do this." });
    }
    next();
  };
}

// Create the three demo accounts if they do not exist yet.
async function seedUsers() {
  const demo = [
    { name: "System Admin",   username: "admin",   email: "admin@abes.demo",   role: "admin",   env: "ADMIN_PASSWORD",   def: "Admin@12345" },
    { name: "Demo Faculty",   username: "faculty", email: "faculty@abes.demo", role: "faculty", env: "FACULTY_PASSWORD", def: "Faculty@12345" },
    { name: "Demo Student",   username: "student", email: "student@abes.demo", role: "student", env: "STUDENT_PASSWORD", def: "Student@12345" },
  ];
  for (const d of demo) {
    if (await db.findUserByLogin(d.username)) continue;
    const pw = process.env[d.env] || d.def;
    if (!process.env[d.env] && isProd) {
      console.warn("WARNING: " + d.env + " is not set - using the public demo password for '" + d.username + "'. Set it on Render!");
    }
    await db.createUser({ name: d.name, username: d.username, email: d.email, role: d.role, password_hash: await bcrypt.hash(pw, 12) });
    console.log("Seeded " + d.role + " account '" + d.username + "'");
  }
}

module.exports = { ROLES, loadUser, requireAuth, requireRole, issueToken, clearToken, publicUser, seedUsers, secret };
