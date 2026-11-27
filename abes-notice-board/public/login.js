// Login page logic. Authentication is done by the server (POST /api/auth/login).
const form = document.getElementById("loginForm");
const loginInput = document.getElementById("login");
const passwordInput = document.getElementById("password");
const pwToggle = document.getElementById("pwToggle");
const errorBox = document.getElementById("loginError");
const loginBtn = document.getElementById("loginBtn");

// Already logged in? Go straight to the notice board.
fetch("/api/auth/me").then(function (r) { if (r.ok) window.location.replace("/"); }).catch(function () {});

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

pwToggle.addEventListener("click", function () {
  const show = passwordInput.type === "password";
  passwordInput.type = show ? "text" : "password";
  pwToggle.textContent = show ? "Hide" : "Show";
  pwToggle.setAttribute("aria-label", show ? "Hide password" : "Show password");
  pwToggle.setAttribute("aria-pressed", show ? "true" : "false");
});

form.addEventListener("submit", async function (event) {
  event.preventDefault();
  errorBox.hidden = true;

  const login = loginInput.value.trim();
  const password = passwordInput.value;
  const role = form.elements.role.value;

  if (!login) return showError("Please enter your username or email.");
  if (!password) return showError("Please enter your password.");

  loginBtn.disabled = true;
  loginBtn.textContent = "Signing in...";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login, password: password, role: role }),
    });
    let data = null;
    try { data = await response.json(); } catch (e) {}
    if (!response.ok) {
      showError((data && data.error) || "Login failed (status " + response.status + ").");
      passwordInput.value = "";
      passwordInput.focus();
      return;
    }
    window.location.replace("/");
  } catch (err) {
    showError("Cannot reach the server. Check your connection and try again.");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});
