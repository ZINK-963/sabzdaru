/* ============================================================
   API CLIENT — talks to the real backend (Next.js in /backend, or the
   zero-dependency dev-server in /backend/dev-server — same contract,
   see docs/API-CONTRACT.md).

   Every call FAILS SOFT: it returns {ok:false,status,error} instead of
   throwing, so callers never need try/catch.

   LIVE vs DEMO MODE
   At boot, bootApp() (live.js) asks GET /api/health. If a SABZDARU
   backend answers → API.live = true and the whole app runs against it
   (catalog, accounts, orders, payments, admin). If nothing answers
   (opened from file://, a static host, an artifact preview…) → API.live
   stays false and the app runs entirely on local demo data, exactly as
   before. That makes the same files usable for both a client demo and
   a real deployment.

   WHERE IS THE BACKEND?
   Same-origin by default ("/api/…") — the supported deployment is the
   backend serving this frontend, so session cookies just work. To point
   at another origin for development: open  index.html?api=http://host:4000
   (remembered in localStorage; ?api= with an empty value clears it) or set
   <meta name="sd-api-base" content="…">. Cross-origin additionally needs
   CORS + SameSite=None cookies on the server — not configured by default.
   ============================================================ */
var API_BASE = (function () {
  try {
    var q = new URLSearchParams(location.search).get("api");
    if (q !== null) localStorage.setItem("sd-api-base", q);
    var v = localStorage.getItem("sd-api-base");
    if (v) return v.replace(/\/$/, "");
    var m = document.querySelector('meta[name="sd-api-base"]');
    if (m && m.content) return m.content.replace(/\/$/, "");
  } catch (e) { /* storage blocked → same-origin */ }
  return "";
})();

async function apiFetch(path, opts) {
  opts = opts || {};
  var timeoutMs = opts.timeoutMs || 15000;
  var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs) : null;
  var init = { method: opts.method || "GET", credentials: "include", headers: {} };
  if (opts.body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = opts.body; }
  if (ctl) init.signal = ctl.signal;
  try {
    var res = await fetch(API_BASE + path, init);
    var data = null;
    try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
    if (!res.ok) {
      return { ok: false, status: res.status, data: data, error: (data && data.error) || ("خطای سرور: " + res.status) };
    }
    return { ok: true, status: res.status, data: data };
  } catch (err) {
    // fetch throws when the network is down / nothing is listening / the request timed out
    return { ok: false, status: 0, data: null, error: "اتصال به سرور برقرار نشد" };
  } finally { if (timer) clearTimeout(timer); }
}

var API = {
  live: false,      // set by detectLive()
  health: null,     // the /api/health payload (gateway kind etc.)
  base: API_BASE,
  get: function (p, o) { return apiFetch(p, o); },
  post: function (p, b) { return apiFetch(p, { method: "POST", body: JSON.stringify(b || {}) }); },
  put: function (p, b) { return apiFetch(p, { method: "PUT", body: JSON.stringify(b || {}) }); },
  patch: function (p, b) { return apiFetch(p, { method: "PATCH", body: JSON.stringify(b || {}) }); },
  del: function (p) { return apiFetch(p, { method: "DELETE" }); },

  // --- auth ---
  requestOtp: function (phone) { return API.post("/api/auth/otp", { phone: phone }); },
  verifyOtp: function (phone, code, name) {
    var payload = { phone: phone, code: code };
    if (name) payload.name = name;
    return API.post("/api/auth/verify", payload);
  },
  logout: function () { return API.post("/api/auth/logout"); },

  // --- catalog ---
  fetchProducts: function (params) {
    var qs = new URLSearchParams(params || {}).toString();
    return API.get("/api/products" + (qs ? "?" + qs : ""));
  },
  fetchProduct: function (slug) { return API.get("/api/products/" + encodeURIComponent(slug)); },
};

/* Is a SABZDARU backend reachable? (strict check: a static host that answers
   200 with an HTML fallback page must NOT count as "live") */
async function detectLive() {
  var r = await apiFetch("/api/health", { timeoutMs: 1500 });
  if (r.ok && r.data && r.data.ok === true && r.data.service === "sabzdaru") {
    API.live = true; API.health = r.data;
  }
  return API.live;
}

/* Persian (Jalali) calendar date, e.g. ۱۴۰۶/۰۸/۱۵ — the server sends ISO timestamps */
function jalali(iso) {
  try { return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso)); }
  catch (e) { return String(iso); }
}

/*
 * mergeApiProduct(local, api) — updates a product with the response of
 * GET /api/products/[slug] (fresh stock, price, reviews). Fields that only
 * make sense locally (icon, id) are left alone. Multi-variant products:
 * only the first variant is used for now, because the cart, filters and
 * listing UI all assume exactly one variant per product.
 */
function mergeApiProduct(local, api) {
  var v = (api.variants && api.variants[0]) || {};
  local.name = api.name;
  local.price = v.price != null ? v.price : local.price;
  local.sale = v.salePrice || null;
  local.stock = v.stock != null ? v.stock : local.stock;
  if (v.expiresAt) { local.expiresAt = v.expiresAt; local.expiry = jalali(v.expiresAt); }
  local.batch = v.batchCode || local.batch;
  local.desc = api.description || local.desc;
  local.usage = api.usage || local.usage;
  local.storage = api.storage || local.storage;
  local.warn = api.warnings || local.warn;
  local.ingredients = api.ingredients || local.ingredients;
  local.attrs = (api.attributes && Object.keys(api.attributes).length) ? api.attributes : local.attrs;
  local.rating = api.rating != null ? api.rating : (local.rating || 0);
  if (api.reviewCount != null) local.reviews = api.reviewCount;
  local.live = true;
  if (api.reviews) {
    S.reviews[local.id] = api.reviews.map(function (r) {
      return { id: r.id, by: r.author, stars: r.rating, text: r.body, helpful: r.helpful || 0, verified: !!r.verified, adminReply: r.adminReply || null };
    });
  }
  return local;
}
