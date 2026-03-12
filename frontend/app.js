/* ============================================
   BLIP CONSOLE — Clerk Auth
   ============================================ */

const config = {
  apiBaseUrl: "https://a4feg8qe30.execute-api.us-west-2.amazonaws.com",
  clerkPublishableKey: "pk_test_bWVhc3VyZWQtZmxhbWluZ28tODguY2xlcmsuYWNjb3VudHMuZGV2JA"
};

const SK = {
  apiKey: "blip_service_api_key",
  session: "blip_session"
};

// ── Helpers ──

const $ = (id) => document.getElementById(id);
const ls = {
  get: (k) => localStorage.getItem(k),
  set: (k, v) => v ? localStorage.setItem(k, v) : localStorage.removeItem(k)
};

function readSession() {
  const raw = ls.get(SK.session);
  return raw ? JSON.parse(raw) : null;
}

function writeSession(s) {
  ls.set(SK.session, s ? JSON.stringify(s) : null);
}

// ── Toast ──

function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  $("toast-container").appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

// ── Fetch ──

async function userFetch(path, opts = {}) {
  const token = await window.Clerk?.session?.getToken();
  if (!token) throw new Error("Sign in first.");
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(opts.headers ?? {}) }
  });
}

function apiFetch(path, opts = {}) {
  const key = $("active-key-input")?.value.trim() || ls.get(SK.apiKey);
  if (!key) throw new Error("Create an API key first.");
  return fetch(`${config.apiBaseUrl}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", "x-api-key": key, ...(opts.headers ?? {}) }
  });
}

// ── Auth ──

function getEmail() {
  return window.Clerk?.user?.primaryEmailAddress?.emailAddress ?? null;
}

function isSignedIn() {
  return Boolean(window.Clerk?.user);
}

async function signOut() {
  await window.Clerk.signOut();
  writeSession(null);
  showView("auth");
  mountSignIn();
}

// ── Views ──

function showView(name) {
  for (const id of ["view-auth", "view-dashboard", "view-loading"]) {
    const node = $(id);
    if (node) node.hidden = (id !== `view-${name}`);
  }
}

const TABS = ["overview", "keys", "usage", "billing"];
let currentTab = null;

function switchTab(tab, pushState = true) {
  if (!TABS.includes(tab)) tab = "overview";
  if (tab === currentTab) return;
  currentTab = tab;

  // Update URL
  if (pushState) {
    const hash = tab === "overview" ? "" : `#${tab}`;
    history.pushState(null, "", location.pathname + location.search + hash);
  }

  // Update nav
  document.querySelectorAll("[data-tab]").forEach(t =>
    t.classList.toggle("active", t.dataset.tab === tab)
  );

  // Swap panels with transition
  for (const id of ["panel-overview", "panel-keys", "panel-usage", "panel-billing"]) {
    const p = $(id);
    if (!p) continue;
    const isTarget = id === `panel-${tab}`;
    if (isTarget) {
      p.hidden = false;
      p.classList.remove("panel-enter");
      void p.offsetWidth; // reflow
      p.classList.add("panel-enter");
    } else {
      p.hidden = true;
    }
  }

  // Scroll main content to top
  document.querySelector(".dash-main")?.scrollTo(0, 0);

  // Load data for the tab
  if (tab === "usage") loadUsageHistory();
  if (tab === "billing") loadBilling();
  if (tab === "keys") loadKeys();
}

function getTabFromHash() {
  const hash = location.hash.replace("#", "");
  return TABS.includes(hash) ? hash : "overview";
}

// ── Usage Stats ──

async function loadUsage() {
  try {
    const res = await userFetch("/v1/usage");
    if (!res.ok) return;
    const data = await res.json();
    $("stat-active").textContent = data.active_sessions ?? 0;
    $("stat-total").textContent = data.total_sessions ?? 0;
    $("stat-keys").textContent = data.api_key_count ?? 0;
  } catch { /* ignore */ }
}

// ── Usage History & Charts ──

async function loadUsageHistory() {
  try {
    const res = await userFetch("/v1/usage/history");
    if (!res.ok) return;
    const data = await res.json();
    renderSessionsChart(data.sessions || []);
    renderModelChart(data.sessions || []);
    renderSessionsTable(data.sessions || [], data.api_keys || []);
  } catch { /* ignore */ }
}

function renderSessionsChart(sessions) {
  const canvas = $("sessions-chart");
  if (!canvas) return;

  const days = 30;
  const now = new Date();
  const labels = [];
  const counts = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString("en", { month: "short", day: "numeric" }));
    counts.push(sessions.filter(s => s.created_at?.startsWith(key)).length);
  }

  if (window._sessionsChart) window._sessionsChart.destroy();
  window._sessionsChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Sessions",
        data: counts,
        borderColor: "#1a1a1a",
        backgroundColor: "rgba(26,26,26,0.04)",
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1a1a1a",
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 10,
          cornerRadius: 6,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 7, font: { size: 11, family: "'Urbanist'" } },
          border: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: "#e8e5e0" },
          ticks: { stepSize: 1, font: { size: 11, family: "'Urbanist'" } },
          border: { display: false }
        }
      }
    }
  });
}

function renderModelChart(sessions) {
  const canvas = $("model-chart");
  if (!canvas) return;

  const modelCounts = {};
  sessions.forEach(s => {
    const m = s.model || "unknown";
    modelCounts[m] = (modelCounts[m] || 0) + 1;
  });

  const labels = Object.keys(modelCounts);
  const data = Object.values(modelCounts);
  const palette = ["#1a1a1a", "#6b6560", "#a09a93", "#d5d1cb", "#e8e5e0"];

  if (labels.length === 0) {
    canvas.parentElement.innerHTML = '<p class="empty" style="padding:40px 0;text-align:center">No data yet.</p>';
    return;
  }

  if (window._modelChart) window._modelChart.destroy();
  window._modelChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyle: "circle",
            font: { size: 12, family: "'Urbanist'" }
          }
        },
        tooltip: {
          backgroundColor: "#1a1a1a",
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 10,
          cornerRadius: 6
        }
      },
      cutout: "65%"
    }
  });
}

function renderSessionsTable(sessions, apiKeys) {
  const container = $("sessions-table");
  if (!container) return;

  if (!sessions.length) {
    container.innerHTML = '<p class="empty">No sessions yet. Create one via the API.</p>';
    return;
  }

  const keyMap = {};
  apiKeys.forEach(k => { keyMap[k.key_id] = k.name || k.key_prefix; });

  const sorted = [...sessions]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 25);

  let html = `<table>
    <thead><tr>
      <th>Session</th><th>API Key</th><th>Model</th><th>Status</th><th>Created</th>
    </tr></thead><tbody>`;

  for (const s of sorted) {
    const shortId = s.session_id.slice(0, 8);
    const keyName = keyMap[s.api_key_id] || s.api_key_id?.slice(0, 8) || "-";
    const date = new Date(s.created_at).toLocaleDateString("en", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const sc = s.status === "active" ? "status-active"
      : s.status === "destroyed" ? "status-destroyed" : "status-other";

    html += `<tr>
      <td><code>${shortId}…</code></td>
      <td>${keyName}</td>
      <td><code>${s.model}</code></td>
      <td><span class="status-badge ${sc}">${s.status}</span></td>
      <td>${date}</td>
    </tr>`;
  }

  html += "</tbody></table>";
  container.innerHTML = html;
}

// ── API Keys ──

async function createKey() {
  const nameInput = $("key-name-input");
  const name = nameInput?.value.trim() || "Untitled key";
  const res = await userFetch("/v1/api-keys", { method: "POST", body: JSON.stringify({ name }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Key creation failed.");
  ls.set(SK.apiKey, body.api_key);
  const activeInput = $("active-key-input");
  if (activeInput) activeInput.value = body.api_key;
  $("new-key-value").textContent = body.api_key;
  $("new-key-alert").hidden = false;
  if (nameInput) nameInput.value = "";
  toast("API key created", "success");
  await loadKeys();
  loadUsage();
}

async function loadKeys() {
  if (!isSignedIn()) return;
  try {
    const res = await userFetch("/v1/api-keys");
    const body = await res.json();
    const list = $("key-list");
    if (!list) return;
    list.innerHTML = "";
    if (!body.items?.length) {
      list.innerHTML = '<p class="empty">No API keys yet.</p>';
      return;
    }
    const activeKey = ls.get(SK.apiKey);
    for (const item of body.items) {
      const isActive = activeKey?.startsWith(item.key_prefix);
      const card = document.createElement("div");
      card.className = "key-card";
      card.innerHTML = `
        <div class="key-info">
          <div class="key-name">${item.name ?? "Unnamed key"}${isActive ? '<span class="key-active-badge">Active</span>' : ""}</div>
          <div class="key-meta"><code>${item.key_prefix}…</code>${item.revoked_at ? ' · <span class="key-revoked">Revoked</span>' : ""}</div>
        </div>
        ${item.revoked_at ? "" : '<button class="btn btn-danger btn-sm">Revoke</button>'}
      `;
      if (!item.revoked_at) {
        card.querySelector("button").addEventListener("click", async () => {
          await userFetch(`/v1/api-keys/${item.key_id}`, { method: "DELETE" });
          if (activeKey?.startsWith(item.key_prefix)) {
            ls.set(SK.apiKey, null);
            const activeInput = $("active-key-input");
            if (activeInput) activeInput.value = "";
          }
          toast("Key revoked", "info");
          await loadKeys();
          loadUsage();
        });
      }
      list.appendChild(card);
    }
  } catch { /* ignore */ }
}

// ── Sessions (available via API, not in dashboard UI) ──

function renderSession() {
  const box = $("session-summary");
  if (!box) return;
  const s = readSession();
  if (!s) { box.innerHTML = '<p class="empty">No active session.</p>'; return; }
  box.innerHTML = `
    <p><strong>Session:</strong> <code>${s.session_id}</code></p>
    <p><strong>Status:</strong> <code>${s.status}</code></p>
    <p><strong>Model:</strong> <code>${s.model}</code></p>
  `;
}

async function createSession() {
  const opts = JSON.parse($("agent-options-input")?.value || "{}");
  const res = await apiFetch("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      model: $("model-input")?.value?.trim() || "claude-sonnet-4-6",
      effort: $("effort-select")?.value || "medium",
      agent_options: opts
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Session creation failed.");
  writeSession(body);
  toast("Session created", "success");
  loadUsage();
}

async function deleteSession() {
  const s = readSession();
  if (!s?.session_id) return;
  await apiFetch(`/v1/sessions/${s.session_id}`, { method: "DELETE" });
  writeSession(null);
  toast("Session deleted", "info");
  loadUsage();
}

function appendLog(label, data) {
  const log = $("event-log");
  if (!log) return;
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const stamp = new Date().toLocaleTimeString();
  log.textContent += `\n[${stamp}] ${label}\n${text}\n`;
  log.scrollTop = log.scrollHeight;
}

// ── Billing ──

async function loadBilling() {
  const el = $("billing-status");
  if (!el) return;
  try {
    const res = await userFetch("/v1/billing/status");
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.has_payment_method) {
      el.innerHTML = `
        <div class="billing-card">
          <span class="billing-dot on"></span>
          <div>
            <div class="billing-label">Payment method on file</div>
            <div class="billing-hint">You'll be invoiced based on your API usage.</div>
          </div>
        </div>
      `;
      const btn = $("add-payment-btn");
      if (btn) btn.textContent = "Update payment method";
    } else {
      el.innerHTML = `
        <div class="billing-card">
          <span class="billing-dot off"></span>
          <div>
            <div class="billing-label">No payment method</div>
            <div class="billing-hint">Add a payment method to enable usage-based billing.</div>
          </div>
        </div>
      `;
    }
  } catch {
    el.innerHTML = '<p class="empty">Billing not configured yet.</p>';
  }
}

async function addPayment() {
  const email = getEmail();
  const res = await userFetch("/v1/billing/setup", {
    method: "POST",
    body: JSON.stringify({
      email,
      success_url: `${location.origin}?billing=success`,
      cancel_url: `${location.origin}?billing=cancel`
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Could not start billing setup.");
  location.href = body.checkout_url;
}

async function manageBilling() {
  const res = await userFetch("/v1/billing/portal", {
    method: "POST",
    body: JSON.stringify({ return_url: location.href })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Could not open billing portal.");
  location.href = body.portal_url;
}

// ── Clerk sign-in mount ──

function mountSignIn() {
  const container = $("clerk-sign-in");
  if (container && window.Clerk) {
    container.innerHTML = "";
    window.Clerk.mountSignIn(container, {
      appearance: {
        variables: {
          colorPrimary: "#1a1a1a",
          colorBackground: "#ffffff",
          colorInputBackground: "#faf9f7",
          colorInputText: "#1a1a1a",
          colorText: "#1a1a1a",
          colorTextSecondary: "#6b6560",
          borderRadius: "8px"
        }
      }
    });
  }
}

// ── Wire events ──

function safe(id, fn) {
  const el = $(id);
  if (el) el.addEventListener("click", () => fn().catch(e => toast(e.message, "error")));
}

function wireEvents() {
  $("nav-sign-out")?.addEventListener("click", () => signOut());

  // Tab navigation (hash routing)
  document.querySelectorAll("[data-tab]").forEach(t => {
    t.addEventListener("click", () => switchTab(t.dataset.tab));
  });
  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.goto));
  });
  window.addEventListener("popstate", () => switchTab(getTabFromHash(), false));

  // Keys
  safe("create-key-btn", createKey);
  $("copy-key-btn")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("new-key-value").textContent);
    toast("Copied to clipboard", "success");
  });
  $("active-key-input")?.addEventListener("change", (e) =>
    ls.set(SK.apiKey, e.target.value.trim())
  );

  // Billing
  safe("add-payment-btn", addPayment);
  safe("manage-billing-btn", manageBilling);

  // Code copy buttons
  document.querySelectorAll(".code-copy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.copy;
      const pre = document.getElementById(targetId);
      if (pre) {
        navigator.clipboard.writeText(pre.textContent);
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      }
    });
  });
}

// ── Init ──

function waitForClerk() {
  return new Promise((resolve) => {
    if (window.Clerk) return resolve(window.Clerk);
    const interval = setInterval(() => {
      if (window.Clerk) {
        clearInterval(interval);
        resolve(window.Clerk);
      }
    }, 50);
  });
}

async function init() {
  showView("loading");

  const params = new URLSearchParams(location.search);
  if (params.has("billing") || params.has("checkout")) {
    history.replaceState({}, "", location.pathname);
    if (params.get("billing") === "success" || params.get("checkout") === "success") {
      setTimeout(() => toast("Payment method saved!", "success"), 500);
    }
  }

  try {
    const clerk = await waitForClerk();
    await clerk.load();
  } catch (e) {
    showView("auth");
    console.error("Clerk failed to load:", e);
    return;
  }

  if (!window.Clerk.user) {
    showView("auth");
    mountSignIn();
    return;
  }

  // Signed in
  showView("dashboard");
  $("nav-user").textContent = getEmail() ?? "";

  const savedKey = ls.get(SK.apiKey);
  if (savedKey && $("active-key-input")) $("active-key-input").value = savedKey;

  // Navigate to the hash route (or overview)
  switchTab(getTabFromHash(), false);
  loadUsage();
}

wireEvents();
init();
