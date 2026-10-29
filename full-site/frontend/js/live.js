/* ============================================================
   LIVE MODE — connects the whole frontend to the backend API.

   Design: the app was built (and still works) as a self-contained demo on
   localStorage. Live mode does NOT fork that code. It
     1. detects a backend (detectLive in api.js) and, only then,
     2. replaces the demo state with server state (catalog, account…),
     3. decorates a handful of view/logic functions (totals, viewAdmin…),
     4. intercepts UI actions in the CAPTURE phase and sends them to the API
        instead (events.js's demo handlers never see them).
   If no backend answers, none of this is installed and the demo runs as-is.

   Server is the source of truth for: catalog+stock, prices & totals (quote),
   orders, payments, accounts and everything in the admin panel.
   The browser keeps only: the cart, compare list, recently viewed, search
   history and (for guests) favourites.
   ============================================================ */

var STATIC_CATS = CATS.slice();            // UI config (icons, filter order) — merged with server categories
var QUOTE = { sig: "", data: null, inflight: null };
var ORDER_VIEW = { id: null, data: null, loading: false, err: null };
var AD = { loaded: {}, pending: {}, orders: [], products: [], moves: [], coupons: [], reviews: [], tickets: [], audit: [], customers: [] };
var live = { sfAt: 0, installed: false };

var ST_LABEL = { PENDING_PAYMENT: "در انتظار پرداخت", PAID: "پرداخت شده", PROCESSING: "در حال پردازش", PACKING: "آماده‌سازی", SHIPPED: "ارسال شده", DELIVERED: "تحویل شده", PAYMENT_FAILED: "پرداخت ناموفق", CANCELLED: "لغو شده", RETURN_REQUESTED: "درخواست مرجوعی", RETURNED: "مرجوع شده", DELIVERY_FAILED: "ارسال ناموفق", REFUNDED: "بازپرداخت شده" };
var ST_REV = {}; Object.keys(ST_LABEL).forEach(function (k) { ST_REV[ST_LABEL[k]] = k; });
var TICKET_REV = { "باز": "open", "در حال بررسی": "in_progress", "در انتظار مشتری": "waiting_customer", "حل شده": "resolved", "بسته شده": "closed" };
var PRIO_REV = { "عادی": "normal", "بالا": "high" };
var TAB_PERM = { products: "products.write", inventory: "inventory.write", orders: "orders.write", customers: "customers.read", promos: "promos.write", reviews: "reviews.moderate", tickets: "tickets.write", content: "content.write", analytics: "analytics.read", audit: "audit.read" };

function ascii(s) { return String(s == null ? "" : s).replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); }); }

/* ───────────── state ───────────── */
function liveState() {
  var keep = { cart: [], favs: [], compare: [], recent: [], searchHistory: [] };
  try { var raw = JSON.parse(localStorage.getItem("sabzdaru.live.v1") || "null"); if (raw) Object.keys(keep).forEach(function (k) { if (Array.isArray(raw[k])) keep[k] = raw[k]; }); } catch (e) { }
  return { products: [], coupons: [], cart: keep.cart, favs: keep.favs, compare: keep.compare, lists: [], routines: [], recent: keep.recent, orders: [], tickets: [], notifs: [], reviews: {}, moves: [], audit: [], user: null, admin: null, searchHistory: keep.searchHistory, prefs: { promo: true, order: true, restock: true }, addresses: [] };
}
function liveSave() { try { localStorage.setItem("sabzdaru.live.v1", JSON.stringify({ cart: S.cart, compare: S.compare, recent: S.recent, searchHistory: S.searchHistory, favs: S.user ? [] : S.favs })); } catch (e) { } }

function applyStorefront(d) {
  var staticBy = {}; STATIC_CATS.forEach(function (c) { staticBy[c.id] = c; });
  d.categories.forEach(function (c) { (c.attributes || []).forEach(function (a) { FD[a.key] = { label: a.label, opts: a.options || [] }; }); });
  CATS = d.categories.map(function (c) {
    var st = staticBy[c.slug], keys = (c.attributes || []).map(function (a) { return a.key; });
    var filters = st ? st.filters.filter(function (f) { return f === "brand" || keys.indexOf(f) > -1; }) : [];
    keys.forEach(function (k) { if (filters.indexOf(k) < 0) filters.splice(Math.max(0, filters.indexOf("brand")), 0, k); });
    if (filters.indexOf("brand") < 0) filters.push("brand");
    return { id: c.slug, name: c.name, icon: st ? st.icon : "i-box", filters: filters };
  });
  BRANDS = d.brands.slice();
  SHIPPING = d.shipping.map(function (s) { return { id: s.id, name: s.name, days: s.days, fee: s.fee, freeAbove: s.freeAbove }; });
  ARTICLES = d.articles.slice();
  S.products = d.products.map(function (p) { p.icon = catOf(p.cat).icon; p.live = true; p.expiry = p.expiresAt ? jalali(p.expiresAt) : ""; return p; });
  if (!SHIPPING.some(function (s) { return s.id === checkout.ship; })) checkout.ship = SHIPPING[0] ? SHIPPING[0].id : "";
  live.sfAt = Date.now();
}
function pruneLocal() {
  S.cart = S.cart.filter(function (c) { return prod(c.id); });
  S.compare = S.compare.filter(function (i) { return prod(i); });
  S.recent = S.recent.filter(function (i) { return prod(i); });
  S.favs = S.favs.filter(function (i) { return prod(i); });
}
async function refreshStorefront(force) {
  if (!force && Date.now() - live.sfAt < 20000) return;
  live.sfAt = Date.now();
  var r = await API.get("/api/storefront"); if (!r.ok) return;
  applyStorefront(r.data); pruneLocal(); liveSave(); render();
}

/* account snapshot: every /api/me* mutation returns the full snapshot, so the UI just replaces its slices */
function applySnapshot(s) {
  S.user = { id: s.user.id, name: s.user.name, mail: s.user.email || "", phone: s.user.phone, role: s.user.role || null };
  S.admin = s.user.role ? s.user.role.key : null;
  S.prefs = s.prefs; S.addresses = s.addresses; S.lists = s.lists; S.routines = s.routines;
  S.favs = s.favs; S.notifs = s.notifs; S.orders = s.orders; S.tickets = s.tickets;
}
function clearAccount() {
  S.user = null; S.admin = null; S.addresses = []; S.lists = []; S.routines = []; S.favs = []; S.notifs = []; S.orders = []; S.tickets = [];
  S.prefs = { promo: true, order: true, restock: true };
  AD = { loaded: {}, pending: {}, orders: [], products: [], moves: [], coupons: [], reviews: [], tickets: [], audit: [], customers: [] };
  liveSave();
}
async function refreshAccount() {
  var r = await API.get("/api/me");
  if (r.ok) applySnapshot(r.data); else if (r.status === 401) clearAccount();
}
async function afterLogin() {
  var guest = S.favs.slice();                       // favourites made while logged out are kept
  await refreshAccount();
  if (!S.user) return;
  var missing = guest.filter(function (id) { return S.favs.indexOf(id) < 0 && prod(id); });
  for (var i = 0; i < missing.length; i++) { var r = await API.put("/api/me/favorites/" + missing[i]); if (r.ok) applySnapshot(r.data); }
}

/* ───────────── helpers for calling the API from the UI ───────────── */
async function call(promise, okMsg) {
  var r = await promise;
  if (!r.ok) {
    if (r.status === 401 && S.user) { clearAccount(); toast("نشست شما منقضی شده؛ دوباره وارد شوید", "error"); render(); return null; }
    toast(r.error || "خطا", "error"); return null;
  }
  if (okMsg) toast(okMsg);
  return r.data;
}
async function snap(promise, okMsg) { var d = await call(promise, okMsg); if (d) { applySnapshot(d); return d; } return null; }
function needLogin(msg) { toast(msg || "برای این کار وارد حساب شوید", "info"); go("account"); }

/* ───────────── cart pricing: the SERVER decides ───────────── */
function cartLines() { return S.cart.map(function (c) { var p = prod(c.id); return p && p.variantId ? { variantId: p.variantId, quantity: c.qty } : null; }).filter(Boolean); }
function quoteSig(code, ship) { return JSON.stringify([cartLines(), (code || "").toUpperCase(), ship]); }
async function ensureQuote(force) {
  if (!S.cart.length) { QUOTE = { sig: "", data: null, inflight: null }; return; }
  var sig = quoteSig(checkout.coupon, checkout.ship);
  if (!force && (QUOTE.sig === sig || QUOTE.inflight === sig)) return;
  QUOTE.inflight = sig;
  var r = await API.post("/api/checkout/quote", { lines: cartLines(), couponCode: checkout.coupon || undefined, shippingMethodId: checkout.ship });
  QUOTE.inflight = null;
  if (r.ok) { QUOTE = { sig: sig, data: r.data, inflight: null }; if (R.view === "cart" || R.view === "checkout") render(); }
}

/* ───────────── placing an order → paying ───────────── */
async function livePlaceFlow() {
  if (checkout.placing) return;
  var lines = cartLines(); if (!lines.length) { toast("سبد خرید خالی است", "error"); return; }
  checkout.placing = true;
  var btn = $("cbnext"); if (btn) { btn.innerHTML = '<span class="spin"></span> در حال انتقال به درگاه'; btn.disabled = true; }
  var a = checkout.address, c = checkout.customer;
  var body = {
    cartId: checkout.cartId || (checkout.cartId = uid("c")), lines: lines, couponCode: checkout.coupon || undefined, shippingMethodId: checkout.ship,
    address: { province: a.prov, city: a.city, line: a.line, postalCode: ascii(a.zip) },
    customer: { name: c.name, phone: ascii(c.phone), email: c.mail || "" }
  };
  var r = await API.post("/api/checkout/place", body);
  if (!r.ok) {
    checkout.placing = false; toast(r.error, "error");
    if (r.status === 409) await refreshStorefront(true);     // stock changed under us → show fresh numbers
    checkout.step = 4; render(); return;
  }
  if (S.user && a.line && !S.addresses.some(function (x) { return x.id && x.line === a.line; }))
    API.post("/api/me/addresses", { prov: a.prov, city: a.city, line: a.line, zip: ascii(a.zip) }).then(function (x) { if (x.ok) applySnapshot(x.data); });
  var sim = (checkout.method === "fail" && API.health && API.health.gateway === "sample") ? "fail" : undefined;
  var p = await API.post("/api/payments/initiate", { orderId: r.data.orderId, simulate: sim });
  checkout.placing = false; checkout.cartId = null;
  if (!p.ok) { toast(p.error, "error"); go("order", { id: r.data.orderId }); return; }
  location.href = p.data.redirectUrl;                         // → bank → /api/payments/callback → #/order/:id
}

/* ───────────── #/order/:id  (where the gateway sends the customer back) ───────────── */
var PAID_KEYS = ["PAID", "PROCESSING", "PACKING", "SHIPPED", "DELIVERED"];
async function loadOrderResult(id) {
  var r = await API.get("/api/orders/" + encodeURIComponent(id));
  if (ORDER_VIEW.id !== id) return;
  ORDER_VIEW.loading = false;
  if (!r.ok) ORDER_VIEW.err = r.error;
  else {
    ORDER_VIEW.data = r.data;
    if (PAID_KEYS.indexOf(r.data.statusKey) > -1) {         // only a CONFIRMED payment empties the cart
      S.cart = []; checkout.coupon = ""; checkout.step = 1; QUOTE = { sig: "", data: null, inflight: null }; liveSave(); renderChrome();
      if (S.user) refreshAccount();
      refreshStorefront(true);
    }
  }
  render();
}
function resultCard(kind, title, body, buttons) {
  var tone = kind === "ok" ? "border-style:solid;border-color:var(--green-soft);background:var(--surface)" : kind === "bad" ? "border-style:solid;border-color:rgba(166,58,46,.3);background:var(--error-bg)" : "border-style:solid;border-color:var(--line);background:var(--surface)";
  var ic = kind === "ok" ? "i-check" : kind === "bad" ? "i-alert" : "i-info", col = kind === "ok" ? "var(--green)" : kind === "bad" ? "var(--error)" : "var(--info)";
  return '<div class="wrap section" style="max-width:720px"><div class="state" style="' + tone + '"><i><span style="color:' + col + '">' + icon(ic) + '</span></i>' +
    '<b class="t-h2">' + esc(title) + '</b>' + body + '<div class="row" style="justify-content:center;margin-top:12px">' + buttons + '</div></div></div>';
}
function viewOrderResult() {
  var id = R.params.id || "";
  var back = '<button class="btn btn-quiet" data-go="home">بازگشت به فروشگاه</button>';
  if (id.indexOf("none") === 0) return resultCard("bad", "بازگشت از درگاه ناموفق بود", '<p>اطلاعات پرداخت دریافت نشد. اگر مبلغی کسر شده، با پشتیبانی تماس بگیرید.</p>', '<button class="btn btn-primary" data-go="cart">بازگشت به سبد خرید</button>' + back);
  if (!API.live) return '<div class="wrap section">' + emptyState("i-alert", "این بخش به سرور نیاز دارد", "سفارش‌های واقعی فقط در حالت اتصال به بک‌اند نمایش داده می‌شوند.", "بازگشت به خانه", 'data-go="home"') + '</div>';
  if (ORDER_VIEW.id !== id) { ORDER_VIEW = { id: id, data: null, loading: true, err: null }; loadOrderResult(id); }
  if (ORDER_VIEW.loading) return '<div class="wrap section" style="max-width:720px"><div class="card card-pad"><div class="skel" style="height:22px;width:40%;margin-bottom:14px"></div><div class="skel" style="height:14px;width:80%;margin-bottom:8px"></div><div class="skel" style="height:14px;width:60%"></div></div></div>';
  if (ORDER_VIEW.err) return resultCard("bad", "سفارش پیدا نشد", '<p>' + esc(ORDER_VIEW.err) + '</p>', back);
  var o = ORDER_VIEW.data, k = o.statusKey;
  if (PAID_KEYS.indexOf(k) > -1)
    return resultCard("ok", "سفارش شما ثبت شد", '<p>شمارهٔ سفارش: ' + esc(o.id) + ' · مبلغ پرداخت‌شده: ' + toman(o.total) + '</p>' + (o.txn ? '<p class="t-tiny">کد پیگیری تراکنش: ' + esc(o.txn.ref) + '</p>' : ""),
      '<button class="btn btn-primary" data-go="account" data-tab="orders">پیگیری سفارش</button>' + back);
  if (k === "PENDING_PAYMENT")
    return resultCard("info", "پرداخت هنوز انجام نشده", '<p>سفارش ' + esc(o.id) + ' ثبت شده و منتظر پرداخت شماست. تا تکمیل پرداخت، کالاها برایتان نگه داشته می‌شوند.</p>',
      '<button class="btn btn-primary" id="pay-continue" data-oid="' + esc(o.oid) + '">ادامه پرداخت</button><button class="btn btn-quiet" data-go="cart">بازگشت به سبد خرید</button>');
  return resultCard("bad", "پرداخت ناموفق بود", '<p>مبلغی از حساب شما کسر نشده است. سفارش ' + esc(o.id) + ' بسته شد و <b>سبد خرید شما حفظ شده</b>؛ می‌توانید دوباره تلاش کنید.</p>',
    '<button class="btn btn-primary" data-go="cart">بازگشت به سبد خرید</button>' + back);
}

/* ───────────── admin panel data ───────────── */
var NEEDS = { dash: ["orders", "products"], products: ["products"], inventory: ["products", "moves"], orders: ["orders"], customers: ["customers"], promos: ["coupons"], reviews: ["reviews"], tickets: ["tickets"], content: [], analytics: ["orders", "products"], audit: ["audit"] };
var DATA_PERM = { orders: "orders", products: "products|inventory", moves: "inventory", coupons: "promos", reviews: "reviews", tickets: "tickets", customers: "customers", audit: "audit" };
var DATA_URL = { orders: "/api/admin/orders", products: "/api/admin/products", moves: "/api/admin/inventory", coupons: "/api/admin/promos", reviews: "/api/admin/reviews", tickets: "/api/admin/tickets", customers: "/api/admin/customers", audit: "/api/admin/audit" };
function permitted(k) { return DATA_PERM[k].split("|").some(function (t) { return can(t); }); }
function adminReady(tab) { return (NEEDS[tab] || []).every(function (k) { return !permitted(k) || AD.loaded[k]; }); }
async function loadAdmin(keys, force) {
  var todo = keys.filter(function (k) { return permitted(k) && (force || !AD.loaded[k]) && !AD.pending[k]; });
  if (!todo.length) return;
  todo.forEach(function (k) { AD.pending[k] = true; });
  await Promise.all(todo.map(async function (k) {
    var r = await API.get(DATA_URL[k]); AD.pending[k] = false; AD.loaded[k] = true;
    if (r.ok) { AD[k] = k === "moves" ? r.data.moves : k === "audit" ? r.data.logs : r.data; if (k === "products") AD.products.forEach(function (p) { p.icon = catOf(p.cat).icon; }); }
    else { AD[k] = []; toast(r.error, "error"); }
  }));
  render();
}
async function adminDone(keys, alsoShop) {
  keys.forEach(function (k) { AD.loaded[k] = false; });
  await loadAdmin(keys, true);
  if (alsoShop) await refreshStorefront(true);
}
function skeletonAdmin() { return '<div class="stack"><div class="skel" style="height:34px;width:30%"></div><div class="skel" style="height:90px"></div><div class="skel" style="height:220px"></div></div>'; }
function liveCustomers() {
  return '<h1 class="t-h1" style="margin-bottom:20px">مشتریان</h1>' + (AD.customers.length
    ? '<div class="table-wrap"><table><thead><tr><th>نام</th><th>موبایل</th><th>سفارش</th><th>مجموع خرید</th><th>عضویت</th></tr></thead><tbody>' +
    AD.customers.map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td class="t-small">' + esc(c.phone) + '</td><td class="t-num">' + fa(c.orders) + '</td><td class="t-num">' + money(c.spent) + '</td><td class="t-tiny">' + esc(c.createdAt) + '</td></tr>'; }).join("") + '</tbody></table></div>'
    : emptyState("i-users", "هنوز مشتری ثبت‌نام نکرده", "مشتریان پس از ورود با کد یک‌بارمصرف اینجا فهرست می‌شوند.", "", ""));
}
function liveReviews() {
  var B = { approved: '<span class="badge badge-success">منتشر شده</span>', pending: '<span class="badge badge-warning">در انتظار بازبینی</span>', rejected: '<span class="badge badge-error">رد شده</span>' };
  return '<h1 class="t-h1" style="margin-bottom:20px">نظرها</h1>' + (AD.reviews.length
    ? '<div class="table-wrap"><table><thead><tr><th>کالا</th><th>نویسنده</th><th>امتیاز</th><th>متن</th><th>وضعیت</th><th></th></tr></thead><tbody>' +
    AD.reviews.map(function (r) {
      return '<tr><td>' + esc(r.pname) + '</td><td>' + esc(r.by) + '</td><td class="t-num">' + fa(r.stars) + '</td><td class="t-small">' + esc(r.text.slice(0, 70)) + '</td><td>' + (B[r.status] || "") + '</td>' +
        '<td><div class="row" style="gap:4px;flex-wrap:nowrap">' + (r.status !== "approved" ? '<button class="btn btn-quiet btn-xs" data-rvmod="' + r.id + '|approved">تأیید</button>' : "") +
        (r.status !== "rejected" ? '<button class="btn btn-quiet btn-xs" data-rvmod="' + r.id + '|rejected">رد</button>' : "") +
        '<button class="btn btn-danger btn-xs" data-rvdel2="' + r.id + '">حذف</button></div></td></tr>';
    }).join("") + '</tbody></table></div>'
    : emptyState("i-star", "نظری ثبت نشده", "نظرهای مشتریان برای بازبینی اینجا می‌آیند.", "", ""));
}
function noAccessCard() {
  return '<div class="wrap section" style="max-width:460px"><div class="card card-pad"><h1 class="t-h2" style="margin-bottom:8px">دسترسی مدیریتی ندارید</h1>' +
    '<p class="t-small" style="margin-bottom:16px">حساب «' + esc(S.user.name) + '» نقش مدیریتی ندارد. اگر باید به پنل دسترسی داشته باشید، از مدیر ارشد بخواهید نقشی به حساب شما بدهد.</p>' +
    '<div class="row"><button class="btn btn-primary" data-go="home">بازگشت به فروشگاه</button><button class="btn btn-quiet" id="logout">خروج از حساب</button></div></div></div>';
}

/* ───────────── installing live mode (only when a backend answered) ───────────── */
function installLive() {
  if (live.installed) return; live.installed = true;
  save = liveSave;
  notify = function () { };                                   // notifications come from the server
  var _prod = prod;
  prod = function (id) { var p = _prod(id); if (p || !API.live) return p; for (var i = 0; i < AD.products.length; i++) if (AD.products[i].id === id) return AD.products[i]; return null; };
  can = function (t) { if (!S.user || !S.user.role) return false; var pm = S.user.role.permissions || []; return t === "dash" || pm.indexOf("*") > -1 || pm.indexOf(TAB_PERM[t]) > -1; };

  var _totals = totals;
  totals = function (code, shipId) {
    var sub = 0, sv = 0;
    S.cart.forEach(function (c) { var p = prod(c.id); if (!p) return; sub += eff(p) * c.qty; if (p.sale) sv += (p.price - p.sale) * c.qty; });
    var q = QUOTE.data && QUOTE.sig === quoteSig(code, shipId) ? QUOTE.data : null;
    if (q) return { sub: q.subtotal, save: q.savings, disc: q.discount, shipFee: q.shippingFee, cErr: q.couponError, total: q.total };
    var m = SHIPPING.filter(function (s) { return s.id === shipId; })[0], fee = m ? m.fee : 0;       // provisional estimate until the server answers
    if (m && m.freeAbove != null && sub >= m.freeAbove) fee = 0;
    return { sub: sub, save: sv, disc: 0, shipFee: fee, cErr: null, total: sub + fee };
  };
  var _summary = summaryCard;
  summaryCard = function (t, w) { return _summary(t, w).replace(/<span class="hint">کدهای فعال نمونه[^<]*<\/span>/, ""); };

  var _viewLogin = viewLogin;
  viewLogin = function () {
    var h = _viewLogin().replace(/<button class="btn btn-quiet btn-block btn-sm" id="demo-login">[^<]*<\/button>/, "");
    return R.view === "admin" ? h.replace("ورود یا ثبت‌نام", "ورود به پنل مدیریت") : h;
  };
  var _verify = verifyOtpFlow;
  verifyOtpFlow = async function () {
    var code = (document.getElementById("lcode") || {}).value || "";
    var name = login.isNewUser ? ((document.getElementById("lname") || {}).value || "") : undefined;
    if (!/^\d{6}$/.test(code)) { login.err = "کد باید ۶ رقم باشد"; render(); return; }
    login.code = code; login.loading = true; login.err = ""; render();
    var r = await API.verifyOtp(login.phone, code, name);
    login.loading = false;
    if (!r.ok) {
      if (r.status === 400 && r.data && r.data.newUser) { login.isNewUser = true; login.err = "برای ساخت حساب، نام را هم وارد کنید"; render(); return; }
      login.err = r.error; render(); return;
    }
    login = { step: 1, phone: "", loading: false, err: "", isNewUser: false, code: "" };
    await afterLogin(); toast("خوش آمدید، " + (S.user ? S.user.name : "")); render();
  };

  var _admBody = admBody;
  admBody = function () {
    var t = adm.tab; loadAdmin(NEEDS[t] || []);
    if (!adminReady(t)) return skeletonAdmin();
    if (t === "customers") return liveCustomers();
    if (t === "reviews") return liveReviews();
    return _admBody();
  };
  var _viewAdmin = viewAdmin;
  viewAdmin = function () {
    if (!S.user) return viewLogin();
    if (!S.user.role) return noAccessCard();
    var real = S;                                              // render the admin UI against admin data, without ever mutating real state
    S = Object.assign({}, real, { orders: AD.orders, products: AD.products, coupons: AD.coupons, tickets: AD.tickets, audit: AD.audit, moves: AD.moves });
    try { return _viewAdmin(); } finally { S = real; }
  };

  var _render = render;
  render = function () {
    if (R.view === "checkout" && S.user && !(checkout.customer && checkout.customer.name)) checkout.customer = { name: S.user.name, phone: S.user.phone, mail: S.user.mail };
    _render();
    if (R.view === "cart" || R.view === "checkout") { ensureQuote(); refreshStorefront(); }
  };
}
async function initLive() {
  var sf = await API.get("/api/storefront");
  if (!sf.ok || !sf.data || !sf.data.products) return false;
  S = liveState(); applyStorefront(sf.data); installLive();
  var me = await API.get("/api/me"); if (me.ok) applySnapshot(me.data);
  pruneLocal();
  return true;
}
async function bootApp() {
  await detectLive();
  if (API.live) { var ok = await initLive(); if (!ok) { API.live = false; toast("اتصال به سرور ناقص بود؛ حالت نمایشی فعال شد", "info"); } }
  parseHash(); render();
}

/* ───────────── UI actions → API (capture phase: runs BEFORE events.js) ───────────── */
function selectedStars() { var s = document.querySelector('[data-star][aria-pressed="true"]'); return s ? +s.getAttribute("data-star") : 5; }
var H = {
  logout: async function () { await API.logout(); clearAccount(); toast("از حساب خارج شدید"); go("home"); },
  fav: async function (id) {
    var on = S.favs.indexOf(id) > -1, prev = S.favs.slice();
    S.favs = on ? S.favs.filter(function (x) { return x !== id; }) : S.favs.concat([id]); render();      // optimistic
    var r = on ? await API.del("/api/me/favorites/" + id) : await API.put("/api/me/favorites/" + id);
    if (r.ok) { applySnapshot(r.data); toast(on ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد"); }
    else { S.favs = prev; toast(r.error, "error"); }
    render();
  },
  listCreate: async function () { var n = val("lname2"); if (!n) { toast("نام لازم است", "error"); return; } if (await snap(API.post("/api/me/lists", { name: n }), "فهرست ساخته شد")) { closeOverlay(); render(); } },
  listRename: async function (id) { if (await snap(API.patch("/api/me/lists/" + id, { name: val("lren") }))) { closeOverlay(); render(); } },
  listDelete: async function (id) { if (await snap(API.del("/api/me/lists/" + id), "فهرست حذف شد")) render(); },
  listItems: async function (lid, pid, add, msg) {
    var l = S.lists.filter(function (x) { return x.id === lid; })[0]; if (!l) return;
    var items = add ? (l.items.indexOf(pid) > -1 ? l.items : l.items.concat([pid])) : l.items.filter(function (x) { return x !== pid; });
    if (await snap(API.patch("/api/me/lists/" + lid, { items: items }), msg)) { closeOverlay(); render(); }
  },
  listNewWith: async function (pid) { var n = val("nlname"); if (!n) { toast("نام فهرست را بنویسید", "error"); return; } if (await snap(API.post("/api/me/lists", { name: n, items: [pid] }), "فهرست ساخته شد")) { closeOverlay(); render(); } },
  routineCreate: async function () {
    var n = val("rname"), steps = []; document.querySelectorAll("[data-rstep]").forEach(function (i) { if (i.checked) steps.push(i.getAttribute("data-rstep")); });
    if (!n) { toast("نام روتین را بنویسید", "error"); return; } if (!steps.length) { toast("حداقل یک محصول انتخاب کنید", "error"); return; }
    if (await snap(API.post("/api/me/routines", { name: n, steps: steps }), "روتین ذخیره شد")) { closeOverlay(); render(); }
  },
  routineDelete: async function (id) { if (await snap(API.del("/api/me/routines/" + id))) render(); },
  addressDelete: async function (i) { var a = S.addresses[+i]; if (a && a.id && await snap(API.del("/api/me/addresses/" + a.id), "نشانی حذف شد")) render(); },
  settings: async function () {
    var prefs = {}; document.querySelectorAll("[data-pref]").forEach(function (i) { prefs[i.getAttribute("data-pref")] = i.checked; });
    if (await snap(API.patch("/api/me", { name: val("setname"), email: val("setmail"), prefs: prefs }), "تغییرات ذخیره شد")) render();
  },
  wipeAsk: function () { dialog("حذف حساب", "<p class='t-small'>حساب و همهٔ اطلاعات شخصی شما (نشانی‌ها، فهرست‌ها، روتین‌ها) حذف می‌شود. سفارش‌های ثبت‌شده برای الزامات مالی، بدون نام شما نگه داشته می‌شوند. این کار برگشت‌پذیر نیست.</p>", '<button class="btn btn-danger" id="wipe-live">بله، حذف شود</button><button class="btn btn-quiet" data-close="1">انصراف</button>'); },
  wipe: async function () { if (await call(API.del("/api/me"), "حساب شما حذف شد")) { closeOverlay(); clearAccount(); go("home"); } },
  orderCancel: async function (ref) { if (await snap(API.post("/api/me/orders/" + encodeURIComponent(ref) + "/cancel"), "سفارش لغو شد و موجودی بازگشت")) { render(); refreshStorefront(true); } },
  orderReturn: async function (ref) { if (await snap(API.post("/api/me/orders/" + encodeURIComponent(ref) + "/return"), "درخواست مرجوعی ثبت شد")) render(); },
  ticketCreate: async function () {
    var s = val("tsub"), m = val("tmsg"); if (s.length < 3 || m.length < 10) { toast("موضوع و توضیح را کامل‌تر بنویسید", "error"); return; }
    if (await snap(API.post("/api/me/tickets", { subject: s, category: val("tcat") || "سایر", priority: PRIO_REV[val("tpri")] || "normal", message: m }), "تیکت ثبت شد")) { closeOverlay(); render(); }
  },
  ticketReply: async function (id) { var v = val("trtext"); if (!v) return; if (await snap(API.post("/api/me/tickets/" + id + "/reply", { message: v }))) { closeOverlay(); render(); } },
  reviewSave: async function (pid) {
    var txt = val("rvtext"); if (txt.length < 10) { toast("متن نظر خیلی کوتاه است", "error"); return; }
    if (await call(API.post("/api/reviews", { productId: pid, rating: selectedStars(), body: txt }), "نظر شما ثبت شد و پس از بازبینی منتشر می‌شود")) { closeOverlay(); render(); }
  },
  helpful: async function (id) {
    var d = await call(API.post("/api/reviews/" + id + "/helpful")); if (!d) return;
    Object.keys(S.reviews).forEach(function (k) { S.reviews[k].forEach(function (r) { if (r.id === id) r.helpful = d.helpful; }); }); render();
  },
  restock: async function (pid) {
    var p = prod(pid); if (!p) return;
    if (S.user) { await call(API.post("/api/restock-alerts", { variantId: p.variantId }), "وقتی موجود شد خبرتان می‌کنیم"); return; }
    dialog("اعلان موجودی", '<div class="field"><label class="t-label" for="rsmail">ایمیل شما</label><input class="input" id="rsmail" type="email" placeholder="name@example.com"></div>',
      '<button class="btn btn-primary" data-restock-go="' + pid + '">ثبت</button><button class="btn btn-quiet" data-close="1">انصراف</button>');
  },
  restockGo: async function (pid) { var p = prod(pid); if (p && await call(API.post("/api/restock-alerts", { variantId: p.variantId, email: val("rsmail") }), "وقتی موجود شد خبرتان می‌کنیم")) closeOverlay(); },
  applyCoupon: async function () {
    checkout.coupon = val("cc"); QUOTE = { sig: "", data: null, inflight: null }; await ensureQuote(true); render();
    if (QUOTE.data && checkout.coupon && !QUOTE.data.couponError) toast("کد تخفیف اعمال شد");
  },
  payContinue: async function (oid) {
    var p = await API.post("/api/payments/initiate", { orderId: oid }); if (!p.ok) { toast(p.error, "error"); return; } location.href = p.data.redirectUrl;
  },
  /* admin */
  productSave: async function (target) {
    var body = { name: val("pn"), variant: val("pv"), price: +val("pp"), stock: +val("ps"), cat: val("pc"), brand: val("pb") };
    if (body.name.length < 2) { toast("نام کالا را وارد کنید", "error"); return; } if (!(body.price > 0)) { toast("قیمت باید بزرگ‌تر از صفر باشد", "error"); return; } if (!(body.stock >= 0)) { toast("موجودی نمی‌تواند منفی باشد", "error"); return; }
    var r = target === "new" ? await API.post("/api/admin/products", body) : await API.patch("/api/admin/products/" + target, body);
    if (!r.ok) { toast(r.error, "error"); return; } toast(target === "new" ? "کالا ساخته شد" : "تغییرات ذخیره شد"); closeOverlay(); await adminDone(["products", "moves", "audit"], true);
  },
  productPublish: async function (id) { var p = prod(id); if (await call(API.patch("/api/admin/products/" + id, { published: !p.published }))) await adminDone(["products", "audit"], true); },
  productRemove: async function (id) { if (await call(API.del("/api/admin/products/" + id), "کالا از فروشگاه برداشته شد")) { closeOverlay(); await adminDone(["products", "audit"], true); } },
  stock: async function (vid, delta) { if (await call(API.patch("/api/admin/inventory/" + encodeURIComponent(vid), { delta: delta }))) await adminDone(["products", "moves", "audit"], true); },
  couponToggle: async function (code) { var c = AD.coupons.filter(function (x) { return x.code === code; })[0]; if (c && await call(API.patch("/api/admin/promos/" + c.id, { active: !c.active }))) await adminDone(["coupons", "audit"]); },
  couponCreate: async function () {
    var b = { code: val("cco").toUpperCase(), type: val("cty"), value: +val("cva"), minSubtotal: +val("cmi") || 0, usageLimit: +val("cli") || undefined };
    if (b.code.length < 3) { toast("کد را وارد کنید", "error"); return; }
    if (await call(API.post("/api/admin/promos", b), "کد ساخته شد")) { closeOverlay(); await adminDone(["coupons", "audit"]); }
  },
  reviewMod: async function (id, status) { if (await call(API.patch("/api/admin/reviews/" + id, { status: status }), status === "approved" ? "نظر منتشر شد" : "نظر رد شد")) { await adminDone(["reviews", "audit"]); refreshStorefront(true); } },
  reviewDel: async function (id) { if (await call(API.del("/api/admin/reviews/" + id), "نظر حذف شد")) await adminDone(["reviews", "audit"]); },
  adminTicket: async function (id) {
    var v = val("tatext"); if (!v) { toast("متن پاسخ خالی است", "error"); return; }
    if (await call(API.patch("/api/admin/tickets/" + id, { reply: v, internal: $("tanote").checked }))) { closeOverlay(); await adminDone(["tickets", "audit"]); }
  },
  orderStatus: async function (ref, label) {
    var key = ST_REV[label]; var r = await API.patch("/api/admin/orders/" + encodeURIComponent(ref), { status: key });
    if (!r.ok) toast(r.error, "error"); else toast("وضعیت به‌روز شد");
    await adminDone(["orders", "audit"], true);
  },
  ticketStatus: async function (id, label) { if (await call(API.patch("/api/admin/tickets/" + id, { status: TICKET_REV[label] }))) await adminDone(["tickets", "audit"]); else render(); }
};

var CLICK = [
  ["#logout", function () { H.logout(); }],
  ["#adlogout", function () { H.logout(); }],
  ["[data-fav]", function (el) { if (!S.user) return false; H.fav(el.getAttribute("data-fav")); }],
  ["[data-tolist]", function () { if (S.user) return false; needLogin("برای ساخت فهرست خرید وارد حساب شوید"); }],
  ["[data-review]", function () { if (S.user) return false; needLogin("برای ثبت نظر وارد حساب شوید"); }],
  ["#savelist", function () { H.listCreate(); }],
  ["[data-lrensave]", function (el) { H.listRename(el.getAttribute("data-lrensave")); }],
  ["[data-ldel]", function (el) { H.listDelete(el.getAttribute("data-ldel")); }],
  ["[data-lrm]", function (el) { var p = el.getAttribute("data-lrm").split("|"); H.listItems(p[0], p[1], false); }],
  ["[data-pick]", function (el) { var p = el.getAttribute("data-pick").split("|"); H.listItems(p[0], p[1], true, "به فهرست اضافه شد"); }],
  ["[data-newlistwith]", function (el) { H.listNewWith(el.getAttribute("data-newlistwith")); }],
  ["#saveroutine", function () { H.routineCreate(); }],
  ["[data-rdel]", function (el) { H.routineDelete(el.getAttribute("data-rdel")); }],
  ["[data-adel]", function (el) { H.addressDelete(el.getAttribute("data-adel")); }],
  ["#savesettings", function () { H.settings(); }],
  ["#wipe", function () { H.wipeAsk(); }],
  ["#wipe-live", function () { H.wipe(); }],
  ["[data-atab]", function (el) { if (el.getAttribute("data-atab") === "notifs" && S.notifs.some(function (n) { return !n.read; })) API.post("/api/me/notifications/read"); return false; }],
  ["[data-ocancel]", function (el) { H.orderCancel(el.getAttribute("data-ocancel")); }],
  ["[data-oreturn]", function (el) { H.orderReturn(el.getAttribute("data-oreturn")); }],
  ["#savet", function () { H.ticketCreate(); }],
  ["[data-trsave]", function (el) { H.ticketReply(el.getAttribute("data-trsave")); }],
  ["[data-rvsave]", function (el) { H.reviewSave(el.getAttribute("data-rvsave")); }],
  ["[data-helpful]", function (el) { H.helpful(el.getAttribute("data-helpful")); }],
  ["[data-restock-go]", function (el) { H.restockGo(el.getAttribute("data-restock-go")); }],
  ["[data-restock]", function (el) { H.restock(el.getAttribute("data-restock")); }],
  ["#applycc", function () { H.applyCoupon(); }],
  ["#cbnext", function () { if (checkout.step !== 5) return false; livePlaceFlow(); }],
  ["#pay-continue", function (el) { H.payContinue(el.getAttribute("data-oid")); }],
  ["[data-psave]", function (el) { H.productSave(el.getAttribute("data-psave")); }],
  ["[data-ppub]", function (el) { H.productPublish(el.getAttribute("data-ppub")); }],
  ["[data-pdelok]", function (el) { H.productRemove(el.getAttribute("data-pdelok")); }],
  ["[data-stk]", function (el) { var p = el.getAttribute("data-stk").split("|"), pr = prod(p[0]); if (pr) H.stock(pr.variantId, +p[1]); }],
  ["[data-ctoggle]", function (el) { H.couponToggle(el.getAttribute("data-ctoggle")); }],
  ["#csave", function () { H.couponCreate(); }],
  ["[data-rvmod]", function (el) { var p = el.getAttribute("data-rvmod").split("|"); H.reviewMod(p[0], p[1]); }],
  ["[data-rvdel2]", function (el) { H.reviewDel(el.getAttribute("data-rvdel2")); }],
  ["[data-tasave]", function (el) { H.adminTicket(el.getAttribute("data-tasave")); }]
];
document.addEventListener("click", function (ev) {
  if (!API.live) return;
  var t = ev.target; if (!t || !t.closest) return;
  for (var i = 0; i < CLICK.length; i++) {
    var el = t.closest(CLICK[i][0]); if (!el) continue;
    if (CLICK[i][1](el, ev) !== false) { ev.stopImmediatePropagation(); ev.preventDefault(); return; }
  }
}, true);
document.addEventListener("change", function (ev) {
  if (!API.live) return; var t = ev.target; if (!t || !t.getAttribute) return;
  if (t.getAttribute("data-ostatus")) { ev.stopImmediatePropagation(); H.orderStatus(t.getAttribute("data-ostatus"), t.value); }
  else if (t.getAttribute("data-tstatus")) { ev.stopImmediatePropagation(); H.ticketStatus(t.getAttribute("data-tstatus"), t.value); }
}, true);
document.addEventListener("submit", function (ev) {
  if (!API.live || !ev.target || ev.target.id !== "newsform") return;
  ev.preventDefault(); ev.stopImmediatePropagation();
  var v = val("newsmail"), err = $("newserr");
  if (!/^\S+@\S+\.\S+$/.test(v)) { err.innerHTML = icon("i-alert") + "نشانی ایمیل معتبر نیست"; err.classList.remove("hidden"); return; }
  err.classList.add("hidden");
  call(API.post("/api/newsletter", { email: v }), "ثبت شد").then(function (d) { if (d) $("newsmail").value = ""; });
}, true);
