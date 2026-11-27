// ABES Department-Wise Digital Notice Board - Backend
// Node.js + Express + role-based authentication (Admin / Faculty / Student)
require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const db = require("./db");
const auth = require("./auth");

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === "production";
const DEPARTMENTS = ["CSE", "IT", "ECE", "ME", "Civil"];

app.set("trust proxy", 1); // Render sits behind a proxy (needed for secure cookies + rate limiting)

// ---------- Middleware ----------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
}));
app.use(express.json({ limit: "20kb" }));
app.use(auth.loadUser);

// Block cross-site state-changing requests (extra CSRF protection on top of SameSite cookies)
app.use("/api", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) {
      return res.status(403).json({ error: "Cross-site request blocked." });
    }
  }
  next();
});

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

// ---------- Health check (Render) - public ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ABES Digital Notice Board" });
});

// ---------- Page protection: the notice board needs a login ----------
app.get(["/", "/index.html"], (req, res) => {
  if (!req.user) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use(express.static(path.join(__dirname, "public"), { index: false }));

// ---------- Auth API ----------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

// A fixed bcrypt hash so unknown users take the same time as known ones
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const body = req.body || {};
    const login = String(body.login || "").trim();
    const password = String(body.password || "");
    const role = String(body.role || "").trim().toLowerCase();

    if (!login || !password) return res.status(400).json({ error: "Username/email and password are required." });
    if (!auth.ROLES.includes(role)) return res.status(400).json({ error: "Please select a valid role." });

    const user = await db.findUserByLogin(login);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Incorrect username/email or password." });
    if (user.role !== role) {
      return res.status(403).json({ error: "This account is not registered as " + role + ". Choose the correct role." });
    }

    auth.issueToken(res, user);
    res.json({ user: auth.publicUser(user) });
  } catch (err) {
    console.error("Login failed:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  auth.clearToken(res);
  res.json({ message: "Logged out." });
});

app.get("/api/auth/me", auth.requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- Notices API (all routes protected) ----------

// View: admin, faculty, student   GET /api/notices?department=CSE
app.get("/api/notices", auth.requireAuth, async (req, res) => {
  try {
    res.json(await db.listNotices(req.query.department));
  } catch (err) {
    console.error("Failed to read notices:", err);
    res.status(500).json({ error: "Could not read notices from the server." });
  }
});

// Add: admin + faculty only
app.post("/api/notices", auth.requireRole("admin", "faculty"), async (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const department = String(body.department || "").trim();
    const date = String(body.date || "").trim();

    if (!title) return res.status(400).json({ error: "Title is required." });
    if (title.length > 100) return res.status(400).json({ error: "Title must be 100 characters or fewer." });
    if (!description) return res.status(400).json({ error: "Description is required." });
    if (description.length > 1000) return res.status(400).json({ error: "Description must be 1000 characters or fewer." });
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ error: "Department must be one of: " + DEPARTMENTS.join(", ") + "." });
    }
    if (!isValidDate(date)) return res.status(400).json({ error: "Date must be a valid date (YYYY-MM-DD)." });

    const notice = await db.createNotice({ title, description, department, date, createdBy: req.user.username });
    res.status(201).json(notice);
  } catch (err) {
    console.error("Failed to save notice:", err);
    res.status(500).json({ error: "Could not save the notice." });
  }
});

// Delete: admin only
app.delete("/api/notices/:id", auth.requireRole("admin"), async (req, res) => {
  try {
    const removed = await db.deleteNotice(req.params.id);
    if (!removed) return res.status(404).json({ error: "Notice not found. It may already be deleted." });
    res.json({ message: "Notice deleted.", id: removed.id });
  } catch (err) {
    console.error("Failed to delete notice:", err);
    res.status(500).json({ error: "Could not delete the notice." });
  }
});

// Unknown API routes -> JSON 404
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

// Bad JSON bodies and other errors
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON in request body." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

// ---------- Startup ----------
async function start() {
  if (isProd && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production (Render's filesystem is not persistent).");
  }
  auth.secret(); // fail fast if JWT_SECRET is missing in production
  await db.init();

  // One-time import of the original notices.json into Postgres
  if (db.kind === "postgres" && (await db.countNotices()) === 0) {
    const seedFile = path.join(__dirname, "data", "notices.json");
    if (fs.existsSync(seedFile)) {
      const list = JSON.parse(fs.readFileSync(seedFile, "utf8").replace(/^\uFEFF/, "") || "[]");
      await db.importNotices(list);
      console.log("Imported " + list.length + " starter notices into the database.");
    }
  }

  await auth.seedUsers();
  app.listen(PORT, () => {
    console.log("ABES Notice Board running at http://localhost:" + PORT + " (storage: " + db.kind + ")");
  });
}

start().catch((err) => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});
