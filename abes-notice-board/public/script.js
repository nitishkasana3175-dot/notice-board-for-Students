// ABES Digital Notice Board - Frontend logic
// All data is loaded from / saved to the backend REST API.

const API_URL = "/api/notices";
const DEPARTMENTS = ["CSE", "IT", "ECE", "ME", "Civil"];

let notices = [];          // all notices from the server
let currentFilter = "All"; // "All" or one department
let currentUser = null;    // set after /api/auth/me succeeds

// ---------- Element references ----------
const nav = document.getElementById("nav");
const grid = document.getElementById("noticeGrid");
const loading = document.getElementById("loading");
const empty = document.getElementById("empty");
const errorBox = document.getElementById("errorBox");
const errorText = document.getElementById("errorText");
const retryBtn = document.getElementById("retryBtn");
const viewTitle = document.getElementById("viewTitle");
const statTotal = document.getElementById("statTotal");
const statShown = document.getElementById("statShown");
const statLatest = document.getElementById("statLatest");

const openAddBtn = document.getElementById("openAddBtn");
const addDialog = document.getElementById("addDialog");
const addForm = document.getElementById("addForm");
const closeDialogBtn = document.getElementById("closeDialogBtn");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const formError = document.getElementById("formError");
const toast = document.getElementById("toast");
const logoutBtn = document.getElementById("logoutBtn");
const userChip = document.getElementById("userChip");
const userName = document.getElementById("userName");
const roleBadge = document.getElementById("roleBadge");
const sidebarFoot = document.getElementById("sidebarFoot");

let toastTimer = null;

// ---------- Small helpers ----------
function todayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

function formatDate(dateString) {
  const d = new Date(dateString + "T00:00:00");
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function showToast(message, isError) {
  toast.textContent = message;
  toast.className = isError ? "toast toast-error" : "toast";
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.hidden = true;
  }, 3000);
}

// Calls the API and returns the parsed JSON, or throws an Error with a readable message
async function request(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error("Cannot reach the server. Check that it is running and try again.");
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = null;
  }

  if (response.status === 401) {
    window.location.replace("/login.html"); // session expired or not logged in
    throw new Error("Please log in again.");
  }
  if (!response.ok) {
    throw new Error((data && data.error) || "Request failed (status " + response.status + ").");
  }
  return data;
}

// ---------- Role helpers ----------
function canAdd() { return currentUser && (currentUser.role === "admin" || currentUser.role === "faculty"); }
function canDelete() { return currentUser && currentUser.role === "admin"; }

function applyRoleUI() {
  const label = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  userName.textContent = currentUser.name;
  roleBadge.textContent = label;
  roleBadge.className = "role-badge role-" + currentUser.role;
  userChip.hidden = false;
  sidebarFoot.textContent = label + " Dashboard";
  openAddBtn.hidden = !canAdd();
}

async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch (e) {}
  window.location.replace("/login.html");
}
logoutBtn.addEventListener("click", logout);

// ---------- Loading data ----------
async function loadNotices() {
  loading.hidden = false;
  errorBox.hidden = true;
  try {
    notices = await request(API_URL);
    render();
  } catch (err) {
    notices = [];
    render();
    errorText.textContent = err.message;
    errorBox.hidden = false;
    empty.hidden = true;
  } finally {
    loading.hidden = true;
  }
}

// ---------- Rendering ----------
function renderNav() {
  nav.innerHTML = "";
  const items = ["All"].concat(DEPARTMENTS);

  items.forEach(function (name) {
    const count = name === "All"
      ? notices.length
      : notices.filter(function (n) { return n.department === name; }).length;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-btn" + (name === currentFilter ? " active" : "");
    btn.setAttribute("aria-pressed", name === currentFilter ? "true" : "false");

    const label = document.createElement("span");
    label.textContent = name === "All" ? "All Departments" : name;

    const badge = document.createElement("span");
    badge.className = "nav-count";
    badge.textContent = count;

    btn.appendChild(label);
    btn.appendChild(badge);
    btn.addEventListener("click", function () {
      currentFilter = name;
      render();
    });
    nav.appendChild(btn);
  });
}

function createCard(notice) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.dept = notice.department;

  const top = document.createElement("div");
  top.className = "card-top";

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = notice.department;

  const date = document.createElement("span");
  date.className = "card-date";
  date.textContent = formatDate(notice.date);

  top.appendChild(badge);
  top.appendChild(date);

  const title = document.createElement("h3");
  title.textContent = notice.title;

  const description = document.createElement("p");
  description.textContent = notice.description;

  const foot = document.createElement("div");
  foot.className = "card-foot";

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", function () {
    deleteNotice(notice, deleteBtn);
  });

  if (canDelete()) foot.appendChild(deleteBtn); // admin only (the server enforces this too)

  card.appendChild(top);
  card.appendChild(title);
  card.appendChild(description);
  card.appendChild(foot);
  return card;
}

function render() {
  renderNav();

  const visible = currentFilter === "All"
    ? notices
    : notices.filter(function (n) { return n.department === currentFilter; });

  // sort newest first
  const sorted = visible.slice().sort(function (a, b) {
    return b.date.localeCompare(a.date);
  });

  grid.innerHTML = "";
  sorted.forEach(function (notice) {
    grid.appendChild(createCard(notice));
  });

  viewTitle.textContent = currentFilter === "All"
    ? "Showing notices from all departments"
    : "Showing notices from " + currentFilter + " department";

  statTotal.textContent = notices.length;
  statShown.textContent = sorted.length;
  statLatest.textContent = notices.length
    ? formatDate(notices.map(function (n) { return n.date; }).sort().pop())
    : "-";

  empty.hidden = sorted.length !== 0 || !errorBox.hidden;
}

// ---------- Delete ----------
async function deleteNotice(notice, button) {
  const ok = confirm('Delete the notice "' + notice.title + '"? This cannot be undone.');
  if (!ok) return;

  button.disabled = true;
  button.textContent = "Deleting...";
  try {
    await request(API_URL + "/" + encodeURIComponent(notice.id), { method: "DELETE" });
    notices = notices.filter(function (n) { return n.id !== notice.id; });
    render();
    showToast("Notice deleted");
  } catch (err) {
    button.disabled = false;
    button.textContent = "Delete";
    showToast(err.message, true);
    // The notice may already be gone on the server, so refresh the list
    loadNotices();
  }
}

// ---------- Add notice dialog ----------
function openDialog() {
  addForm.reset();
  document.getElementById("date").value = todayString();
  formError.hidden = true;
  addDialog.showModal();
  document.getElementById("title").focus();
}

function closeDialog() {
  addDialog.close();
}

openAddBtn.addEventListener("click", openDialog);
closeDialogBtn.addEventListener("click", closeDialog);
cancelBtn.addEventListener("click", closeDialog);

// Close when the dark backdrop is clicked
addDialog.addEventListener("click", function (event) {
  if (event.target === addDialog) closeDialog();
});

addForm.addEventListener("submit", async function (event) {
  event.preventDefault();
  formError.hidden = true;

  const payload = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    department: document.getElementById("department").value,
    date: document.getElementById("date").value,
  };

  // quick check in the browser (the server checks again)
  if (!payload.title || !payload.description || !payload.department || !payload.date) {
    formError.textContent = "Please fill in the title, description, department and date.";
    formError.hidden = false;
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  try {
    const created = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    notices.push(created);
    errorBox.hidden = true;
    render();
    closeDialog();
    showToast("Notice added");
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save notice";
  }
});

retryBtn.addEventListener("click", loadNotices);

// ---------- Start ----------
(async function init() {
  try {
    const me = await request("/api/auth/me");
    currentUser = me.user;
  } catch (err) {
    return; // request() already redirects to the login page on 401
  }
  applyRoleUI();
  loadNotices();
})();
