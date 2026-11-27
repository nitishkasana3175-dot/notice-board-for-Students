// ABES Department-Wise Digital Notice Board - Backend
// Node.js + Express. Notices are stored in data/notices.json

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "notices.json");
const DEPARTMENTS = ["CSE", "IT", "ECE", "ME", "Civil"];

// ---------- Middleware ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- Helpers to read / write the JSON file ----------
function readNotices() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  if (raw.trim() === "") {
    return [];
  }
  return JSON.parse(raw);
}

function writeNotices(notices) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(notices, null, 2), "utf8");
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// ---------- Health check (Render deployment) ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "ABES Digital Notice Board" });
});

// ---------- REST API ----------

// GET /api/notices  (optional: ?department=CSE)
app.get("/api/notices", (req, res) => {
  try {
    let notices = readNotices();
    const { department } = req.query;

    if (department && department !== "All") {
      notices = notices.filter((n) => n.department === department);
    }

    // newest notice first
    notices.sort((a, b) => b.date.localeCompare(a.date));
    res.json(notices);
  } catch (err) {
    console.error("Failed to read notices:", err);
    res.status(500).json({ error: "Could not read notices from the server." });
  }
});

// POST /api/notices
app.post("/api/notices", (req, res) => {
  try {
    const body = req.body || {};
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const department = String(body.department || "").trim();
    const date = String(body.date || "").trim();

    // validation
    if (!title) return res.status(400).json({ error: "Title is required." });
    if (title.length > 100) {
      return res.status(400).json({ error: "Title must be 100 characters or fewer." });
    }
    if (!description) return res.status(400).json({ error: "Description is required." });
    if (description.length > 1000) {
      return res.status(400).json({ error: "Description must be 1000 characters or fewer." });
    }
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ error: "Department must be one of: " + DEPARTMENTS.join(", ") + "." });
    }
    if (!isValidDate(date)) {
      return res.status(400).json({ error: "Date must be a valid date (YYYY-MM-DD)." });
    }

    const notices = readNotices();
    const newNotice = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      description,
      department,
      date,
    };

    notices.push(newNotice);
    writeNotices(notices);
    res.status(201).json(newNotice);
  } catch (err) {
    console.error("Failed to save notice:", err);
    res.status(500).json({ error: "Could not save the notice." });
  }
});

// DELETE /api/notices/:id
app.delete("/api/notices/:id", (req, res) => {
  try {
    const notices = readNotices();
    const index = notices.findIndex((n) => n.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Notice not found. It may already be deleted." });
    }

    const [removed] = notices.splice(index, 1);
    writeNotices(notices);
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
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body." });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log("ABES Notice Board running at http://localhost:" + PORT);
});
