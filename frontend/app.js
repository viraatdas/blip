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
  const key = $("active-key-input")?.value.trim();
  if (!key) throw new Error("Set an active API key first.");
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

let currentTab = "overview";

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".nav-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  for (const id of ["panel-overview", "panel-keys", "panel-sessions", "panel-billing"]) {
    const p = $(id);
    if (p) p.hidden = (id !== `panel-${tab}`);
  }
}

// ── Usage ──

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

// ── API Keys ──

async function createKey() {
  const res = await userFetch("/v1/api-keys", { method: "POST", body: JSON.stringify({ name: "console-key" }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Key creation failed.");
  $("active-key-input").value = body.api_key;
  ls.set(SK.apiKey, body.api_key);
  $("new-key-value").textContent = body.api_key;
  $("new-key-alert").hidden = false;
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
    list.innerHTML = "";
    if (!body.items?.length) {
      list.innerHTML = `<p class="empty" style="padding:16px">No API keys yet.</p>`;
      return;
    }
    for (const item of body.items) {
      const card = document.createElement("div");
      card.className = "key-card";
      card.innerHTML = `
        <div>
          <p class="key-name">${item.name ?? "Unnamed key"}</p>
          <p class="key-prefix">${item.key_prefix}</p>
        </div>
        <button class="btn btn-danger btn-sm">Revoke</button>
      `;
      card.querySelector("button").addEventListener("click", async () => {
        await userFetch(`/v1/api-keys/${item.key_id}`, { method: "DELETE" });
        const active = $("active-key-input").value.trim();
        if (active.startsWith(item.key_prefix)) {
          $("active-key-input").value = "";
          ls.set(SK.apiKey, null);
        }
        toast("Key revoked", "info");
        await loadKeys();
        loadUsage();
      });
      list.appendChild(card);
    }
  } catch { /* ignore */ }
}

// ── Sessions ──

function renderSession() {
  const s = readSession();
  const box = $("session-summary");
  if (!s) { box.innerHTML = `<p class="empty">No active session.</p>`; return; }
  box.innerHTML = `
    <p><strong>Session:</strong> <code>${s.session_id}</code></p>
    <p><strong>Status:</strong> <code>${s.status}</code></p>
    <p><strong>Model:</strong> <code>${s.model}</code></p>
    <p><strong>Effort:</strong> <code>${s.effort}</code></p>
    <p><strong>Idle expiry:</strong> ${s.idle_expires_at ?? "n/a"}</p>
    <p><strong>Hard expiry:</strong> ${s.hard_expires_at ?? "n/a"}</p>
  `;
}

async function createSession() {
  const opts = JSON.parse($("agent-options-input").value || "{}");
  const res = await apiFetch("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      model: $("model-input").value.trim(),
      effort: $("effort-select").value,
      agent_options: opts
    })
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Session creation failed.");
  writeSession(body);
  renderSession();
  appendLog("session-created", body);
  toast("Session created", "success");
  loadUsage();
}

async function refreshSession() {
  const s = readSession();
  if (!s) throw new Error("No session.");
  const res = await apiFetch(`/v1/sessions/${s.session_id}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.message ?? "Refresh failed.");
  writeSession({ ...s, ...body });
  renderSession();
}

async function deleteSession() {
  const s = readSession();
  if (!s?.session_id) return;
  await apiFetch(`/v1/sessions/${s.session_id}`, { method: "DELETE" });
  closeSSE();
  writeSession(null);
  renderSession();
  appendLog("session-delete", "Session deleted.");
  toast("Session deleted", "info");
  loadUsage();
}

async function bootstrap() {
  const s = readSession();
  if (!s?.bootstrap_url) throw new Error("Create a session first.");
  const key = $("claude-key-input").value.trim();
  if (!key) throw new Error("Enter your Claude API key.");
  const res = await fetch(s.bootstrap_url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key })
  });
  if (!res.ok) throw new Error(`Bootstrap failed (${res.status}).`);
  appendLog("bootstrap", "Bootstrap succeeded.");
  toast("Session bootstrapped", "success");
}

let eventSource = null;

function closeSSE() {
  if (eventSource) { eventSource.close(); eventSource = null; }
}

async function connectSSE() {
  const s = readSession();
  if (!s?.session_id) throw new Error("Create a session first.");
  closeSSE();
  const tokenRes = await apiFetch(`/v1/sessions/${s.session_id}/stream-token`, {
    method: "POST", body: JSON.stringify({})
  });
  const body = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(body.message ?? "Could not get stream token.");
  eventSource = new EventSource(body.events_url);
  appendLog("events", "Connected to SSE.");
  eventSource.addEventListener("ready", (e) => appendLog("ready", e.data));
  eventSource.addEventListener("heartbeat", () => {});
  eventSource.addEventListener("sdk-message", (e) => appendLog("sdk-message", JSON.parse(e.data)));
  eventSource.addEventListener("result", (e) => appendLog("result", JSON.parse(e.data)));
  eventSource.onerror = () => appendLog("events", "SSE connection lost.");
}

async function sendMessage() {
  const s = readSession();
  if (!s?.session_id) throw new Error("Create a session first.");
  const prompt = $("prompt-input").value.trim();
  if (!prompt) throw new Error("Enter a prompt.");
  appendLog("prompt", prompt);
  const res = await apiFetch(`/v1/sessions/${s.session_id}/messages`, {
    method: "POST", body: JSON.stringify({ prompt })
  });
  const body = await res.json();
  if (!res.ok) { appendLog("error", body); throw new Error(body.message ?? "Message failed."); }
  appendLog("result", body);
}

// ── Event log ──

function appendLog(label, data) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const stamp = new Date().toLocaleTimeString();
  const log = $("event-log");
  log.textContent += `\n[${stamp}] ${label}\n${text}\n`;
  log.scrollTop = log.scrollHeight;
}

// ── Billing ──

async function loadBilling() {
  const el = $("billing-status");
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
      $("add-payment-btn").textContent = "Update payment method";
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
    el.innerHTML = `<p class="empty">Billing not configured yet.</p>`;
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

  // Tabs
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.addEventListener("click", () => switchTab(t.dataset.tab));
  });

  // Goto links in overview
  document.querySelectorAll("[data-goto]").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.goto));
  });

  // Keys
  safe("create-key-btn", createKey);
  $("copy-key-btn")?.addEventListener("click", () => {
    navigator.clipboard.writeText($("new-key-value").textContent);
    toast("Copied to clipboard", "success");
  });
  $("active-key-input")?.addEventListener("change", (e) => ls.set(SK.apiKey, e.target.value.trim()));

  // Sessions
  safe("create-session-btn", createSession);
  safe("refresh-session-btn", refreshSession);
  safe("delete-session-btn", deleteSession);
  safe("bootstrap-btn", bootstrap);
  safe("connect-events-btn", connectSSE);
  safe("send-message-btn", sendMessage);
  $("clear-log-btn")?.addEventListener("click", () => { $("event-log").textContent = "Waiting for session activity."; });

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

  // Wait for Clerk script to load, then initialize
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

  // Signed in — show dashboard
  showView("dashboard");
  $("nav-user").textContent = getEmail() ?? "";

  const savedKey = ls.get(SK.apiKey);
  if (savedKey && $("active-key-input")) $("active-key-input").value = savedKey;

  renderSession();
  loadUsage();
  loadKeys();
  loadBilling();
}

wireEvents();
init();
