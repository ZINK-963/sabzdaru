#!/usr/bin/env node
'use strict';
/**
 * سرور توسعه/دموی سبزدارو — بدون هیچ وابستگی (فقط Node ≥ 18)، همهٔ داده‌ها در حافظه.
 *
 * این فایل «محصول نهایی» نیست. دو کار دارد:
 *  ۱) مرجع اجرایی قرارداد API (docs/API-CONTRACT.md): همان مسیرها، همان اعتبارسنجی‌ها،
 *     همان پیام‌های خطا و همان انتقال‌های وضعیت که مسیرهای Next.js/Prisma در backend/app/api
 *     پیاده می‌کنند. فرانت‌اند در حالت «زنده» روی همین سرور تست شده است.
 *  ۲) اجرای کامل اپ بدون PostgreSQL/Redis برای دموی کارفرما یا توسعهٔ فرانت‌اند:
 *        node backend/dev-server/server.js   →   http://localhost:4000
 *
 * کاتالوگ از خود frontend/js/data.js خوانده می‌شود، پس همان ۲۸ محصول نمایشی است.
 * وضعیت در dev-server/data.json ذخیره می‌شود (PERSIST_FILE=none برای خاموش‌کردن).
 * کد ورود (OTP) در کنسول چاپ می‌شود. حساب‌های مدیریتی دمو (کد ورود مثل بقیه):
 *   09120000000 مدیر ارشد · 09120000001 مدیر فروشگاه · 09120000002 مدیر انبار
 *   09120000003 پشتیبانی · 09120000004 مدیر محتوا · 09120000005 مدیر مالی
 */
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

const PORT = +process.env.PORT || 4000;
const FRONT = path.resolve(process.env.FRONTEND_DIR || path.join(__dirname, '..', '..', 'frontend'));
const PERSIST = process.env.PERSIST_FILE === 'none' ? null : (process.env.PERSIST_FILE || path.join(__dirname, 'data.json'));
const FIXED_OTP = process.env.DEV_FIXED_OTP || null;
const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron';
const GATEWAY = 'sample';
/* همان CSP موجود در next.config.js — تا تست e2e فرانت‌اند ناسازگاری احتمالی را بگیرد (DEV_CSP=0 خاموشش می‌کند) */
const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"].join('; ');

/* ───────────── helpers ───────────── */
const fmt = ts => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts));
const uid = p => p + crypto.randomBytes(5).toString('hex');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const faDigits = s => String(s).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const PHONE_RE = /^0?9\d{9}$/;
const normPhone = p => { p = faDigits(p); return p.startsWith('0') ? p : '0' + p; };
class HttpError extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra || {}; } }
const bad = (msg, details) => new HttpError(400, msg || 'ورودی نامعتبر', details ? { details } : {});

/* ───────────── constants (mirror backend/app/api) ───────────── */
const ST = { PENDING_PAYMENT: 'در انتظار پرداخت', PAID: 'پرداخت شده', PROCESSING: 'در حال پردازش', PACKING: 'آماده‌سازی', SHIPPED: 'ارسال شده', DELIVERED: 'تحویل شده', PAYMENT_FAILED: 'پرداخت ناموفق', CANCELLED: 'لغو شده', RETURN_REQUESTED: 'درخواست مرجوعی', RETURNED: 'مرجوع شده', DELIVERY_FAILED: 'ارسال ناموفق', REFUNDED: 'بازپرداخت شده' };
const TRANSITIONS = {
  PENDING_PAYMENT: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'], PAID: ['PROCESSING', 'CANCELLED', 'REFUNDED'], PROCESSING: ['PACKING', 'CANCELLED'],
  PACKING: ['SHIPPED', 'CANCELLED'], SHIPPED: ['DELIVERED', 'DELIVERY_FAILED'], DELIVERED: ['RETURN_REQUESTED'], DELIVERY_FAILED: ['PROCESSING', 'CANCELLED'],
  RETURN_REQUESTED: ['RETURNED', 'DELIVERED'], RETURNED: ['REFUNDED'], PAYMENT_FAILED: ['CANCELLED'], CANCELLED: [], REFUNDED: []
};
const RESTOCK_ON = new Set(['CANCELLED', 'RETURNED']);
const TICKET_ST = { open: 'باز', in_progress: 'در حال بررسی', waiting_customer: 'در انتظار مشتری', resolved: 'حل شده', closed: 'بسته شده' };
const TICKET_ST_REV = Object.fromEntries(Object.entries(TICKET_ST).map(([k, v]) => [v, k]));
const PRIO = { normal: 'عادی', high: 'بالا' };
const ROLES = {
  super: ['*'], store: ['products.write', 'orders.write', 'customers.read', 'promos.write', 'content.write', 'reviews.moderate', 'analytics.read'],
  inv: ['inventory.write', 'products.write'], support: ['orders.write', 'customers.read', 'tickets.write', 'reviews.moderate'],
  content: ['content.write'], finance: ['orders.write', 'analytics.read', 'promos.write']
};
const ROLE_NAMES = { super: 'مدیر ارشد', store: 'مدیر فروشگاه', inv: 'مدیر انبار', support: 'پشتیبانی', content: 'مدیر محتوا', finance: 'مدیر مالی' };
const DEV_ADMINS = { '09120000000': 'super', '09120000001': 'store', '09120000002': 'inv', '09120000003': 'support', '09120000004': 'content', '09120000005': 'finance' };
const ADMIN_PERM = [['products', 'products.write'], ['inventory', 'inventory.write'], ['orders', 'orders.write'], ['customers', 'customers.read'], ['promos', 'promos.write'], ['reviews', 'reviews.moderate'], ['tickets', 'tickets.write'], ['content', 'content.write'], ['analytics', 'analytics.read'], ['audit', 'audit.read']];
const PAID_SET = ['PAID', 'PROCESSING', 'PACKING', 'SHIPPED', 'DELIVERED'];

/* ───────────── in-memory database ───────────── */
let db;
const sessions = new Map(), otps = new Map(), rate = new Map();

function loadCatalog() {
  const sb = { localStorage: { getItem: () => null, setItem() { }, removeItem() { } } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(FRONT, 'js', 'data.js'), 'utf8'), sb, { filename: 'data.js' });
  return vm.runInContext('({CATS,BRANDS,FD,SEEDP,ARTICLES,SEEDC,SHIPPING})', sb);
}
function seedDb() {
  const C = loadCatalog(), t0 = Date.now();
  const exp = t0 + 10 * 30 * 86400000;
  const counters = {};
  const d = {
    categories: C.CATS.map(c => ({ slug: c.id, name: c.name, attributes: c.filters.filter(f => f !== 'brand').map(f => ({ key: f, label: C.FD[f].label, options: C.FD[f].opts })) })),
    brands: C.BRANDS.map(b => ({ slug: b.id, name: b.name, desc: b.desc })),
    products: C.SEEDP.map(p => {
      counters[p.cat] = (counters[p.cat] || 0) + 1;
      return { id: p.id, slug: p.cat + '-' + counters[p.cat], cat: p.cat, brand: p.brand, name: p.name, variant: p.variant, variantId: 'v_' + p.id, price: p.price, sale: p.sale || null, stock: p.stock, attrs: p.attrs || {}, desc: p.desc, usage: p.usage, storage: p.storage, warn: p.warn, ingredients: p.ingredients, published: true, sold: p.sold, views: p.views, expiresAt: exp, batch: 'B-' + p.id, createdAt: t0 };
    }),
    articles: C.ARTICLES.map(a => ({ id: a.id, slug: a.id, title: a.title, cat: a.cat, read: a.read, tag: a.tag, body: a.body, reviewedBy: 'تیم محتوا', publishedAt: t0 })),
    shipping: C.SHIPPING.map(s => ({ id: 'ship_' + s.id, name: s.name, days: s.days, fee: s.fee, freeAbove: s.id === 'pick' ? null : 800000, active: true })),
    coupons: C.SEEDC.map(c => ({ id: uid('cp_'), code: c.code, type: c.type, value: c.value, minSubtotal: c.min, maxDiscount: c.max || null, usageLimit: c.limit || null, perUserLimit: null, usedCount: 0, active: c.active, startsAt: null, endsAt: c.active ? null : t0 - 86400000 })),
    users: Object.entries(DEV_ADMINS).map(([phone, roleKey]) => ({ id: uid('u_'), phone, name: ROLE_NAMES[roleKey], email: '', roleKey, prefs: { order: true, restock: true, promo: true }, deletedAt: null, createdAt: t0 })),
    reviews: [{ id: uid('r_'), productId: 'p1', userId: null, by: 'کاربر نمونه', stars: 5, text: 'این یک نظر نمونه برای نمایش ساختار صفحه است و از مشتری واقعی نیست.', status: 'approved', helpful: 3, verified: true, adminReply: null, createdAt: t0 }],
    addresses: [], lists: [], routines: [], favs: [], notifs: [], orders: [], payments: [], tickets: [], moves: [], audit: [], subscribers: [], restock: [], seq: 100000
  };
  return d;
}
let saveTimer = null;
function persist() {
  if (!PERSIST) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(PERSIST, JSON.stringify(db)); } catch (e) { console.error('persist failed', e.message); } }, 250);
}
function initDb() {
  if (PERSIST && fs.existsSync(PERSIST)) { try { db = JSON.parse(fs.readFileSync(PERSIST, 'utf8')); return; } catch (e) { console.warn('data.json unreadable, reseeding'); } }
  db = seedDb();
}

/* ───────────── domain helpers ───────────── */
const byId = id => db.products.find(p => p.id === id);
const byVariant = vid => db.products.find(p => p.variantId === vid);
const user = id => db.users.find(u => u.id === id && !u.deletedAt);
const roleName = k => ROLE_NAMES[k] || k;
function reviewStats(pid) { const rs = db.reviews.filter(r => r.productId === pid && r.status === 'approved'); return { n: rs.length, avg: rs.length ? Math.round(rs.reduce((a, r) => a + r.stars, 0) / rs.length * 10) / 10 : 0 }; }
function uiProduct(p) {
  const s = reviewStats(p.id);
  return { id: p.id, slug: p.slug, cat: p.cat, brand: p.brand, name: p.name, variant: p.variant, variantId: p.variantId, price: p.price, sale: p.sale || null, stock: p.stock, attrs: p.attrs, desc: p.desc, usage: p.usage, storage: p.storage, warn: p.warn, ingredients: p.ingredients, rating: s.avg, reviews: s.n, sold: p.sold, views: p.views, expiresAt: p.expiresAt ? new Date(p.expiresAt).toISOString() : null, batch: p.batch, published: p.published };
}
function notifyUser(uid_, title, body) { if (uid_) db.notifs.push({ id: uid('n_'), userId: uid_, title, body, ts: Date.now(), readAt: null }); }
function audit(actor, action, entity, entityId, before, after) {
  db.audit.unshift({ id: uid('a_'), who: actor ? roleName(actor.roleKey) : 'سیستم', actorId: actor ? actor.id : null, action, entity, entityId, before: before == null ? null : before, after: after == null ? null : after, ts: Date.now() });
  db.audit = db.audit.slice(0, 500);
}
function move(variantId, delta, reason, refId, actorId) { db.moves.unshift({ id: uid('m_'), variantId, delta, reason, refId: refId || null, actorId: actorId || null, ts: Date.now() }); db.moves = db.moves.slice(0, 500); }
function restock(order, reason) { for (const it of order.items) { const p = byVariant(it.variantId); if (p) { p.stock += it.qty; move(it.variantId, it.qty, reason, order.id); } } }
function addEvent(o, to, by, actorType) { o.events.push({ from: o.status, to, by, actorType, ts: Date.now() }); o.status = to; }
function uiOrder(o, full) {
  const pay = db.payments.find(p => p.orderId === o.id && p.status === 'verified');
  const x = {
    id: o.number, oid: o.id, status: ST[o.status], statusKey: o.status, at: fmt(o.createdAt), total: o.total, sub: o.subtotal, disc: o.discount, shipFee: o.shippingFee, ship: o.shippingMethodId,
    items: o.items.map(i => ({ pid: i.productId, name: i.name, variant: i.variant, brand: i.brand, qty: i.qty, price: i.price, was: i.was })),
    history: o.events.map(e => ({ from: e.from ? ST[e.from] : '—', to: ST[e.to], by: e.by, at: fmt(e.ts) })), txn: pay ? { ref: pay.gatewayRef, at: fmt(pay.ts) } : null, trackingCode: o.trackingCode || null
  };
  if (full) { x.customer = o.customer; x.address = o.address; }
  return x;
}
function uiTicket(t, internal) {
  return { id: t.id, subject: t.subject, cat: t.category, priority: PRIO[t.priority] || t.priority, status: TICKET_ST[t.status], at: fmt(t.ts), msgs: t.messages.filter(m => internal || !m.internal).map(m => ({ by: m.internal ? 'یادداشت داخلی' : m.by, text: m.text, at: fmt(m.ts) })) };
}
function snapshot(u) {
  const mine = a => a.filter(x => x.userId === u.id);
  return {
    user: { id: u.id, name: u.name, phone: u.phone, email: u.email || '', role: u.roleKey ? { key: u.roleKey, name: roleName(u.roleKey), permissions: ROLES[u.roleKey] || [] } : null },
    prefs: u.prefs, addresses: mine(db.addresses).map(a => ({ id: a.id, prov: a.province, city: a.city, line: a.line, zip: a.postalCode })),
    lists: mine(db.lists).map(l => ({ id: l.id, name: l.name, items: l.items })), routines: mine(db.routines).map(r => ({ id: r.id, name: r.name, steps: r.steps })),
    favs: mine(db.favs).map(f => f.productId), notifs: mine(db.notifs).sort((a, b) => b.ts - a.ts).map(n => ({ id: n.id, title: n.title, body: n.body, at: fmt(n.ts), read: !!n.readAt })),
    orders: mine(db.orders).sort((a, b) => b.createdAt - a.createdAt).map(o => uiOrder(o, true)), tickets: mine(db.tickets).sort((a, b) => b.ts - a.ts).map(t => uiTicket(t, false))
  };
}

/* quote / totals — mirrors backend/lib/pricing.ts computeTotals, but reports problems instead of throwing */
function computeQuote(lines, code, shipId, userId) {
  const issues = [], items = []; let sub = 0, savings = 0;
  for (const l of lines) {
    const p = byVariant(l.variantId);
    if (!p || !p.published) { issues.push({ variantId: l.variantId, message: 'این کالا دیگر در دسترس نیست' }); continue; }
    const unit = p.sale || p.price;
    items.push({ variantId: l.variantId, productId: p.id, name: p.name, variant: p.variant, brand: p.brand, quantity: l.quantity, unitPrice: unit, was: p.price, available: p.stock });
    if (l.quantity > p.stock) issues.push({ variantId: l.variantId, message: p.stock <= 0 ? 'ناموجود' : 'فقط ' + p.stock + ' عدد موجود است' });
    sub += unit * l.quantity; if (p.sale) savings += (p.price - p.sale) * l.quantity;
  }
  let discount = 0, couponError = null, coupon = null;
  if (code) {
    coupon = db.coupons.find(c => c.code === String(code).toUpperCase());
    const n = Date.now();
    if (!coupon) couponError = 'کد تخفیف نامعتبر است';
    else if (!coupon.active) couponError = coupon.endsAt && coupon.endsAt < n ? 'این کد منقضی شده' : 'این کد فعال نیست';
    else if (coupon.startsAt && coupon.startsAt > n) couponError = 'این کد هنوز فعال نشده';
    else if (coupon.endsAt && coupon.endsAt < n) couponError = 'این کد منقضی شده';
    else if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) couponError = 'ظرفیت استفاده از این کد تمام شده';
    else if (sub < coupon.minSubtotal) couponError = 'حداقل خرید برای این کد ' + coupon.minSubtotal.toLocaleString('fa-IR') + ' تومان است';
    else if (userId && coupon.perUserLimit && db.orders.filter(o => o.userId === userId && o.couponCode === coupon.code && o.status !== 'PAYMENT_FAILED').length >= coupon.perUserLimit) couponError = 'شما قبلاً از این کد استفاده کرده‌اید';
    else discount = Math.round(coupon.type === 'percent' ? Math.min(sub * coupon.value / 100, coupon.maxDiscount || Infinity) : coupon.value);
    if (couponError) coupon = null;
  }
  let shippingFee = 0; const m = shipId && db.shipping.find(s => s.id === shipId && s.active);
  if (m) { shippingFee = m.fee; if (m.freeAbove != null && sub - discount >= m.freeAbove) shippingFee = 0; }
  return { items, issues, subtotal: sub, savings, discount, shippingFee, total: Math.max(0, sub - discount) + shippingFee, couponError, coupon };
}

/* ───────────── validation (mirrors the zod schemas) ───────────── */
function linesOf(b) {
  if (!b || !Array.isArray(b.lines) || b.lines.length < 1 || b.lines.length > 50) throw bad();
  return b.lines.map(l => { if (!l || typeof l.variantId !== 'string' || !Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 20) throw bad(); return { variantId: l.variantId, quantity: l.quantity }; });
}

/* ───────────── routing ───────────── */
const routes = [];
const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler });
const getSess = req => { const m = /(?:^|;\s*)sd_session=([a-f0-9]+)/.exec(req.headers.cookie || ''); return m ? { sid: m[1], ...(sessions.get(m[1]) || {}) } : {}; };
function authed(req) { const s = getSess(req); const u = s.userId && user(s.userId); if (!u) throw new HttpError(401, 'ورود لازم است'); return u; }
function adminOnly(req, perm) {
  const u = authed(req);
  if (!u.roleKey) throw new HttpError(403, 'دسترسی کافی ندارید');
  const perms = ROLES[u.roleKey] || [];
  if (!perms.includes('*') && !perms.includes(perm)) throw new HttpError(403, 'دسترسی کافی ندارید');
  return u;
}
function limit(key, max, secs) { const n = Date.now(), r = rate.get(key); if (!r || r.until < n) { rate.set(key, { c: 1, until: n + secs * 1000 }); return true; } r.c++; return r.c <= max; }

/* — meta — */
route('GET', '/api/health', () => ({ ok: true, service: 'sabzdaru', gateway: GATEWAY, sms: 'console', time: new Date().toISOString() }));
route('GET', '/api/storefront', () => ({
  categories: db.categories, brands: db.brands.map(b => ({ id: b.slug, name: b.name, desc: b.desc })),
  products: db.products.filter(p => p.published).map(uiProduct),
  articles: db.articles.filter(a => a.publishedAt).map(a => ({ id: a.id, slug: a.slug, title: a.title, cat: a.cat, read: a.read, tag: a.tag, body: a.body })),
  shipping: db.shipping.filter(s => s.active).map(s => ({ id: s.id, name: s.name, days: s.days, fee: s.fee, freeAbove: s.freeAbove })), freeShippingAbove: 800000
}));
route('GET', '/api/products/:slug', (req, res, p) => {
  const x = db.products.find(q => q.slug === p.slug && q.published); if (!x) throw new HttpError(404, 'کالا پیدا نشد');
  const revs = db.reviews.filter(r => r.productId === x.id && r.status === 'approved').sort((a, b) => b.createdAt - a.createdAt);
  const u = uiProduct(x);
  return { id: x.id, slug: x.slug, name: x.name, description: x.desc, usage: x.usage, storage: x.storage, warnings: x.warn, ingredients: x.ingredients, attributes: x.attrs, rating: u.rating || null, reviewCount: u.reviews, variants: [{ id: x.variantId, sku: 'SKU-' + x.id.toUpperCase(), label: x.variant, price: x.price, salePrice: x.sale, stock: x.stock, expiresAt: u.expiresAt, batchCode: x.batch }], reviews: revs.map(r => ({ id: r.id, rating: r.stars, body: r.text, verified: r.verified, author: r.by, adminReply: r.adminReply, helpful: r.helpful, createdAt: new Date(r.createdAt).toISOString() })) };
});

/* — auth — */
route('POST', '/api/auth/otp', (req, res, p, b, ip) => {
  if (!b || typeof b.phone !== 'string' || !PHONE_RE.test(faDigits(b.phone))) throw bad('شمارهٔ موبایل معتبر نیست');
  const phone = normPhone(b.phone);
  if (!limit('otp:ip:' + ip, 50, 3600) || !limit('otp:ph:' + phone, 5, 3600)) throw new HttpError(429, 'تعداد درخواست‌ها بیش از حد مجاز است، کمی بعد تلاش کنید');
  const code = FIXED_OTP || String(crypto.randomInt(100000, 999999));
  otps.set(phone, { hash: sha(code), attempts: 0, until: Date.now() + 120000 });
  console.log(`[DEV SMS] to ${phone}: کد ورود شما ${code} است`);
  return { ok: true, expiresInSeconds: 120 };
});
route('POST', '/api/auth/verify', (req, res, p, b, ip, setCookie) => {
  if (!b || !PHONE_RE.test(faDigits(b.phone || '')) || !/^\d{6}$/.test(String(b.code || ''))) throw bad();
  const phone = normPhone(b.phone), o = otps.get(phone);
  if (!o || o.until < Date.now()) throw bad('کد منقضی شده یا ارسال نشده؛ دوباره درخواست دهید');
  if (o.attempts >= 5) { otps.delete(phone); throw new HttpError(429, 'تعداد تلاش‌های نادرست بیش از حد مجاز است؛ کد جدید بگیرید'); }
  if (sha(b.code) !== o.hash) { o.attempts++; throw bad('کد وارد شده نادرست است'); }
  let u = db.users.find(x => x.phone === phone && !x.deletedAt);
  /* a brand-new user must also send a name. Ask for it WITHOUT consuming the code,
     otherwise the code is already burned when the client comes back with the name. */
  if (!u && (!b.name || String(b.name).trim().length < 2)) throw new HttpError(400, 'برای ساخت حساب، نام لازم است', { newUser: true });
  otps.delete(phone);
  if (!u) {
    u = { id: uid('u_'), phone, name: String(b.name).trim().slice(0, 80), email: '', roleKey: null, prefs: { order: true, restock: true, promo: true }, deletedAt: null, createdAt: Date.now() };
    db.users.push(u); notifyUser(u.id, 'خوش آمدید', 'حساب شما ساخته شد.'); persist();
  }
  const sid = crypto.randomBytes(32).toString('hex'); sessions.set(sid, { userId: u.id });
  setCookie('sd_session=' + sid + '; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000');
  return { ok: true, user: { id: u.id, name: u.name, phone: u.phone } };
});
route('POST', '/api/auth/logout', (req, res, p, b, ip, setCookie) => { const s = getSess(req); if (s.sid) sessions.delete(s.sid); setCookie('sd_session=; HttpOnly; Path=/; Max-Age=0'); return { ok: true }; });
route('GET', '/api/internal/whoami', req => { const u = authed(req); if (!u.roleKey) throw new HttpError(403, 'no role assigned'); return { userId: u.id, roleKey: u.roleKey, permissions: ROLES[u.roleKey] }; });

/* — checkout & payment — */
route('POST', '/api/checkout/quote', (req, res, p, b) => {
  const lines = linesOf(b), q = computeQuote(lines, b.couponCode && String(b.couponCode).trim().slice(0, 30), b.shippingMethodId, (getSess(req).userId));
  return { items: q.items, issues: q.issues, subtotal: q.subtotal, savings: q.savings, discount: q.discount, shippingFee: q.shippingFee, total: q.total, couponError: q.couponError };
});
route('POST', '/api/checkout/place', (req, res, p, b, ip) => {
  if (!limit('checkout:' + ip, 100, 3600)) throw new HttpError(429, 'تعداد تلاش‌ها بیش از حد مجاز است');
  const lines = linesOf(b), a = b.address || {}, c = b.customer || {};
  const errs = {};
  if (!b.cartId) errs.cartId = 'required'; if (!b.shippingMethodId) errs.shippingMethodId = 'required';
  if (String(a.province || '').length < 2) errs.province = 'min'; if (String(a.city || '').length < 2) errs.city = 'min';
  if (String(a.line || '').length < 10) errs.line = 'min'; if (!/^\d{10}$/.test(String(a.postalCode || ''))) errs.postalCode = 'format';
  if (String(c.name || '').length < 3) errs.name = 'min'; if (!PHONE_RE.test(String(c.phone || ''))) errs.phone = 'format';
  if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) errs.email = 'format';
  if (Object.keys(errs).length) throw bad('ورودی نامعتبر', errs);
  const sess = getSess(req), u = sess.userId ? user(sess.userId) : null;
  if (!db.shipping.find(s => s.id === b.shippingMethodId && s.active)) throw bad('روش ارسال نامعتبر است');
  for (const l of lines) {
    const pr = byVariant(l.variantId);
    if (!pr || !pr.published) throw new HttpError(409, 'این کالا فعلاً قابل فروش نیست', { variantId: l.variantId });
    if (pr.stock < l.quantity) throw new HttpError(409, `موجودی کافی نیست: ${pr.stock} عدد موجود، ${l.quantity} عدد درخواست شده`, { variantId: l.variantId });
  }
  const q = computeQuote(lines, b.couponCode, b.shippingMethodId, u && u.id);
  if (q.couponError) throw bad(q.couponError);
  const id = uid('ord_'), number = 'SD-' + (++db.seq);
  const o = { id, number, userId: u ? u.id : null, status: 'PENDING_PAYMENT', items: q.items.map(i => ({ productId: i.productId, variantId: i.variantId, name: i.name, variant: i.variant, brand: (db.brands.find(x => x.slug === i.brand) || {}).name || '', qty: i.quantity, price: i.unitPrice, was: i.was })), subtotal: q.subtotal, discount: q.discount, shippingFee: q.shippingFee, total: q.total, couponCode: b.couponCode ? String(b.couponCode).toUpperCase() : null, shippingMethodId: b.shippingMethodId, address: { province: a.province, city: a.city, line: a.line, postalCode: a.postalCode }, customer: { name: c.name, phone: c.phone, email: c.email || '' }, events: [], trackingCode: null, createdAt: Date.now() };
  o.events.push({ from: null, to: 'PENDING_PAYMENT', by: 'مشتری', actorType: 'customer', ts: Date.now() });
  for (const it of o.items) { byVariant(it.variantId).stock -= it.qty; byVariant(it.variantId).sold += it.qty; move(it.variantId, -it.qty, 'sale', o.id); }
  if (q.coupon) q.coupon.usedCount++;
  db.orders.push(o); notifyUser(o.userId, `سفارش ${number} ثبت شد`, 'سفارش شما در انتظار پرداخت است.');
  audit(u, 'order.create', 'Order', o.id, null, { status: o.status, total: o.total }); persist();
  return { orderId: id, orderNumber: number, total: o.total };
});
route('POST', '/api/payments/initiate', (req, res, p, b, ip, setCookie, origin) => {
  if (!limit('payinit:' + ip, 100, 3600)) throw new HttpError(429, 'تعداد درخواست‌ها بیش از حد مجاز است');
  const o = b && db.orders.find(x => x.id === b.orderId); if (!o) throw new HttpError(404, 'سفارش پیدا نشد');
  if (o.status !== 'PENDING_PAYMENT') throw new HttpError(409, 'این سفارش دیگر در انتظار پرداخت نیست');
  const ref = 'SAMPLE-' + crypto.randomBytes(8).toString('hex');
  db.payments.push({ id: uid('pay_'), orderId: o.id, gateway: GATEWAY, amount: o.total, status: 'initiated', gatewayRef: ref, ts: Date.now() });
  persist();
  return { redirectUrl: `${origin}/api/payments/callback?gatewayRef=${ref}&simulate=${b.simulate === 'fail' ? 'failure' : 'success'}` };
});
route('GET', '/api/payments/callback', (req, res, p, b, ip, setCookie, origin, q) => {
  const ref = q.get('gatewayRef') || q.get('Authority');
  if (!ref) return { __redirect: `${origin}/#/order/none?reason=missing_ref` };
  const pay = [...db.payments].reverse().find(x => x.gatewayRef === ref);
  if (!pay) return { __redirect: `${origin}/#/order/none?reason=unknown_ref` };
  const o = db.orders.find(x => x.id === pay.orderId);
  if (pay.status === 'verified' || pay.status === 'failed') return { __redirect: `${origin}/#/order/${o.id}` };
  const ok = q.get('simulate') === 'success';
  pay.status = ok ? 'verified' : 'failed';
  addEvent(o, ok ? 'PAID' : 'PAYMENT_FAILED', 'درگاه پرداخت', 'gateway');
  if (ok) notifyUser(o.userId, `پرداخت سفارش ${o.number} تأیید شد`, 'سفارش شما ثبت و در صف پردازش قرار گرفت.');
  else { restock(o, 'return'); notifyUser(o.userId, `پرداخت سفارش ${o.number} ناموفق بود`, 'مبلغی از حساب شما کسر نشده است.'); }
  audit(null, 'payment.callback', 'Order', o.id, null, { status: o.status }); persist();
  return { __redirect: `${origin}/#/order/${o.id}` };
});
route('GET', '/api/orders/:id', (req, res, p) => {
  const o = db.orders.find(x => x.id === p.id); if (!o) throw new HttpError(404, 'سفارش پیدا نشد');
  return uiOrder(o, false);
});
route('POST', '/api/internal/cron/expire-orders', (req, res, p, b) => {
  if (req.headers['x-cron-secret'] !== CRON_SECRET) throw new HttpError(401, 'unauthorized');
  const mins = b && b.olderThanMinutes !== undefined ? Math.max(0, +b.olderThanMinutes || 0) : 30, cutoff = Date.now() - mins * 60000; let n = 0;
  for (const o of db.orders) if (o.status === 'PENDING_PAYMENT' && o.createdAt <= cutoff) { addEvent(o, 'CANCELLED', 'سیستم', 'system'); restock(o, 'expired'); n++; }
  if (n) { audit(null, 'order.expire', 'Order', '*', null, { count: n }); persist(); }
  return { expired: n };
});

/* — public engagement — */
route('POST', '/api/reviews', (req, res, p, b) => {
  const u = authed(req);
  if (!b || !byId(b.productId)) throw new HttpError(404, 'کالا پیدا نشد');
  if (!Number.isInteger(b.rating) || b.rating < 1 || b.rating > 5 || String(b.body || '').trim().length < 10) throw bad();
  if (db.reviews.some(r => r.productId === b.productId && r.userId === u.id)) throw new HttpError(409, 'قبلاً برای این کالا نظر ثبت کرده‌اید');
  const verified = db.orders.some(o => o.userId === u.id && PAID_SET.includes(o.status) && o.items.some(i => i.productId === b.productId));
  db.reviews.push({ id: uid('r_'), productId: b.productId, userId: u.id, by: u.name, stars: b.rating, text: String(b.body).trim().slice(0, 2000), status: 'pending', helpful: 0, verified, adminReply: null, createdAt: Date.now() });
  persist(); return { ok: true, pending: true };
});
route('POST', '/api/reviews/:id/helpful', (req, res, p, b, ip) => {
  const r = db.reviews.find(x => x.id === p.id && x.status === 'approved'); if (!r) throw new HttpError(404, 'نظر پیدا نشد');
  if (!limit('helpful:' + ip + p.id, 1, 86400)) throw new HttpError(429, 'قبلاً ثبت کرده‌اید');
  r.helpful++; persist(); return { ok: true, helpful: r.helpful };
});
route('POST', '/api/restock-alerts', (req, res, p, b) => {
  const pr = b && byVariant(b.variantId); if (!pr) throw new HttpError(404, 'کالا پیدا نشد');
  const s = getSess(req), u = s.userId && user(s.userId); const contact = (b.email && /^\S+@\S+\.\S+$/.test(b.email) ? b.email : (u ? (u.email || u.phone) : null));
  if (!contact) throw bad('برای اعلان موجودی، ایمیل یا ورود لازم است');
  if (!db.restock.some(r => r.variantId === b.variantId && r.contact === contact)) db.restock.push({ variantId: b.variantId, contact, ts: Date.now() });
  persist(); return { ok: true };
});
route('POST', '/api/newsletter', (req, res, p, b) => {
  if (!b || !/^\S+@\S+\.\S+$/.test(b.email || '')) throw bad('نشانی ایمیل معتبر نیست');
  if (!db.subscribers.some(s => s.email === b.email)) db.subscribers.push({ email: b.email, ts: Date.now() });
  persist(); return { ok: true };
});

/* — customer account — */
route('GET', '/api/me', req => snapshot(authed(req)));
route('PATCH', '/api/me', (req, res, p, b) => {
  const u = authed(req);
  if (b && b.name !== undefined) { if (String(b.name).trim().length < 2) throw bad(); u.name = String(b.name).trim().slice(0, 80); }
  if (b && b.email !== undefined) { if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) throw bad('ایمیل معتبر نیست'); u.email = b.email || ''; }
  if (b && b.prefs) for (const k of ['order', 'restock', 'promo']) if (typeof b.prefs[k] === 'boolean') u.prefs[k] = b.prefs[k];
  persist(); return snapshot(u);
});
route('DELETE', '/api/me', (req, res, p, b, ip, setCookie) => {
  const u = authed(req); u.deletedAt = Date.now(); u.name = 'کاربر حذف‌شده'; u.email = ''; u.phone = 'deleted-' + u.id;
  for (const k of ['addresses', 'lists', 'routines', 'favs', 'notifs']) db[k] = db[k].filter(x => x.userId !== u.id);
  const s = getSess(req); if (s.sid) sessions.delete(s.sid); setCookie('sd_session=; HttpOnly; Path=/; Max-Age=0'); persist(); return { ok: true };
});
route('POST', '/api/me/addresses', (req, res, p, b) => {
  const u = authed(req);
  if (!b || String(b.prov || '').length < 2 || String(b.city || '').length < 2 || String(b.line || '').length < 10 || !/^\d{10}$/.test(String(b.zip || ''))) throw bad();
  if (!db.addresses.some(a => a.userId === u.id && a.line === b.line)) db.addresses.push({ id: uid('ad_'), userId: u.id, province: b.prov, city: b.city, line: b.line, postalCode: b.zip });
  persist(); return snapshot(u);
});
route('DELETE', '/api/me/addresses/:id', (req, res, p) => { const u = authed(req); db.addresses = db.addresses.filter(a => !(a.id === p.id && a.userId === u.id)); persist(); return snapshot(u); });
route('POST', '/api/me/lists', (req, res, p, b) => {
  const u = authed(req); if (!b || String(b.name || '').trim().length < 1) throw bad();
  db.lists.push({ id: uid('l_'), userId: u.id, name: String(b.name).trim().slice(0, 60), items: (Array.isArray(b.items) ? b.items : []).filter(i => byId(i)) }); persist(); return snapshot(u);
});
route('PATCH', '/api/me/lists/:id', (req, res, p, b) => {
  const u = authed(req), l = db.lists.find(x => x.id === p.id && x.userId === u.id); if (!l) throw new HttpError(404, 'فهرست پیدا نشد');
  if (b && b.name !== undefined) { if (!String(b.name).trim()) throw bad(); l.name = String(b.name).trim().slice(0, 60); }
  if (b && Array.isArray(b.items)) l.items = [...new Set(b.items.filter(i => byId(i)))];
  persist(); return snapshot(u);
});
route('DELETE', '/api/me/lists/:id', (req, res, p) => { const u = authed(req); db.lists = db.lists.filter(l => !(l.id === p.id && l.userId === u.id)); persist(); return snapshot(u); });
route('POST', '/api/me/routines', (req, res, p, b) => {
  const u = authed(req); if (!b || !String(b.name || '').trim() || !Array.isArray(b.steps) || !b.steps.length) throw bad();
  db.routines.push({ id: uid('rt_'), userId: u.id, name: String(b.name).trim().slice(0, 60), steps: b.steps.filter(i => byId(i)) }); persist(); return snapshot(u);
});
route('DELETE', '/api/me/routines/:id', (req, res, p) => { const u = authed(req); db.routines = db.routines.filter(r => !(r.id === p.id && r.userId === u.id)); persist(); return snapshot(u); });
route('PUT', '/api/me/favorites/:pid', (req, res, p) => {
  const u = authed(req); if (!byId(p.pid)) throw new HttpError(404, 'کالا پیدا نشد');
  if (!db.favs.some(f => f.userId === u.id && f.productId === p.pid)) db.favs.push({ userId: u.id, productId: p.pid }); persist(); return snapshot(u);
});
route('DELETE', '/api/me/favorites/:pid', (req, res, p) => { const u = authed(req); db.favs = db.favs.filter(f => !(f.userId === u.id && f.productId === p.pid)); persist(); return snapshot(u); });
route('POST', '/api/me/notifications/read', req => { const u = authed(req); db.notifs.forEach(n => { if (n.userId === u.id) n.readAt = n.readAt || Date.now(); }); persist(); return snapshot(u); });
function myOrder(u, ref) { const o = db.orders.find(x => (x.number === ref || x.id === ref) && x.userId === u.id); if (!o) throw new HttpError(404, 'سفارش پیدا نشد'); return o; }
route('POST', '/api/me/orders/:ref/cancel', (req, res, p) => {
  const u = authed(req), o = myOrder(u, p.ref);
  if (!['PAID', 'PROCESSING', 'PACKING'].includes(o.status)) throw new HttpError(409, 'این سفارش دیگر قابل لغو نیست');
  addEvent(o, 'CANCELLED', 'مشتری', 'customer'); restock(o, 'return'); audit(u, 'order.cancel', 'Order', o.id, { status: 'PAID' }, { status: 'CANCELLED' }); persist(); return snapshot(u);
});
route('POST', '/api/me/orders/:ref/return', (req, res, p) => {
  const u = authed(req), o = myOrder(u, p.ref);
  if (o.status !== 'DELIVERED') throw new HttpError(409, 'فقط سفارش تحویل‌شده قابل مرجوع‌کردن است');
  addEvent(o, 'RETURN_REQUESTED', 'مشتری', 'customer'); persist(); return snapshot(u);
});
route('POST', '/api/me/tickets', (req, res, p, b) => {
  const u = authed(req);
  if (!b || String(b.subject || '').length < 3 || String(b.message || '').length < 10) throw bad();
  db.tickets.push({ id: uid('tk_'), userId: u.id, subject: String(b.subject).slice(0, 120), category: String(b.category || 'سایر').slice(0, 40), priority: b.priority === 'high' ? 'high' : 'normal', status: 'open', ts: Date.now(), messages: [{ by: u.name, text: String(b.message).slice(0, 2000), internal: false, ts: Date.now() }] });
  persist(); return snapshot(u);
});
route('POST', '/api/me/tickets/:id/reply', (req, res, p, b) => {
  const u = authed(req), t = db.tickets.find(x => x.id === p.id && x.userId === u.id); if (!t) throw new HttpError(404, 'تیکت پیدا نشد');
  if (t.status === 'closed') throw new HttpError(409, 'این تیکت بسته شده است');
  if (!b || !String(b.message || '').trim()) throw bad();
  t.messages.push({ by: u.name, text: String(b.message).slice(0, 2000), internal: false, ts: Date.now() }); t.status = 'open'; persist(); return snapshot(u);
});

/* — admin (RBAC identical to middleware.ts ROUTE_PERMISSIONS) — */
route('GET', '/api/admin/products', req => { adminOnly(req, 'products.write'); return db.products.map(p => ({ ...uiProduct(p), published: p.published })); });
route('POST', '/api/admin/products', (req, res, p, b) => {
  const u = adminOnly(req, 'products.write');
  if (!b || String(b.name || '').trim().length < 2 || !(b.price > 0) || !Number.isInteger(b.price) || !(b.stock >= 0) || !db.categories.some(c => c.slug === b.cat) || !db.brands.some(x => x.slug === b.brand)) throw bad();
  const n = db.products.length + 1; let id = 'p' + n; while (byId(id)) id = 'p' + (+id.slice(1) + 1);
  const cnt = db.products.filter(x => x.cat === b.cat).length + 1;
  const pr = { id, slug: b.cat + '-' + cnt + '-' + id, cat: b.cat, brand: b.brand, name: String(b.name).trim(), variant: String(b.variant || '').trim(), variantId: 'v_' + id, price: b.price, sale: null, stock: b.stock, attrs: {}, desc: '', usage: '', storage: '', warn: '', ingredients: '', published: true, sold: 0, views: 0, expiresAt: null, batch: 'B-' + id, createdAt: Date.now() };
  db.products.push(pr); if (pr.stock) move(pr.variantId, pr.stock, 'ثبت کالای تازه', null, u.id);
  audit(u, 'product.create', 'Product', id, null, { name: pr.name, price: pr.price }); persist(); return { ...uiProduct(pr), published: true };
});
route('PATCH', '/api/admin/products/:id', (req, res, p, b) => {
  const u = adminOnly(req, 'products.write'), pr = byId(p.id); if (!pr) throw new HttpError(404, 'کالا پیدا نشد');
  if (!b) throw bad();
  const before = { name: pr.name, published: pr.published, price: pr.price, stock: pr.stock };
  if (b.name !== undefined) { if (String(b.name).trim().length < 2) throw bad(); pr.name = String(b.name).trim(); }
  if (b.variant !== undefined) pr.variant = String(b.variant);
  if (b.description !== undefined) pr.desc = String(b.description);
  if (b.published !== undefined) pr.published = !!b.published;
  if (b.price !== undefined) { if (!Number.isInteger(b.price) || b.price <= 0) throw bad(); pr.price = b.price; }
  if (b.cat !== undefined) { if (!db.categories.some(c => c.slug === b.cat)) throw bad(); pr.cat = b.cat; }
  if (b.brand !== undefined) { if (!db.brands.some(x => x.slug === b.brand)) throw bad(); pr.brand = b.brand; }
  let delta = b.stockDelta || 0; if (b.stock !== undefined) { if (!Number.isInteger(b.stock) || b.stock < 0) throw bad(); delta = b.stock - pr.stock; }
  if (delta) { if (pr.stock + delta < 0) throw new HttpError(409, 'موجودی نمی‌تواند منفی شود'); pr.stock += delta; move(pr.variantId, delta, 'اصلاح دستی انبار', null, u.id); }
  audit(u, 'product.update', 'Product', pr.id, before, { name: pr.name, published: pr.published, price: pr.price, stock: pr.stock }); persist();
  return { ...uiProduct(pr), published: pr.published };
});
route('DELETE', '/api/admin/products/:id', (req, res, p) => {
  const u = adminOnly(req, 'products.write'), pr = byId(p.id); if (!pr) throw new HttpError(404, 'کالا پیدا نشد');
  pr.published = false; audit(u, 'product.unpublish', 'Product', pr.id, { published: true }, { published: false }); persist(); return { ok: true };
});
route('GET', '/api/admin/inventory', req => {
  adminOnly(req, 'inventory.write');
  return { moves: db.moves.slice(0, 50).map(m => { const pr = byVariant(m.variantId); return { id: m.id, pid: pr ? pr.id : null, name: pr ? pr.name : m.variantId, qty: m.delta, reason: m.reason, at: fmt(m.ts) }; }) };
});
route('PATCH', '/api/admin/inventory/:vid', (req, res, p, b) => {
  const u = adminOnly(req, 'inventory.write'), pr = byVariant(p.vid); if (!pr) throw new HttpError(404, 'واریانت پیدا نشد');
  if (!b || !Number.isInteger(b.delta) || b.delta === 0) throw bad('مقدار تغییر نمی‌تواند صفر باشد');
  if (pr.stock + b.delta < 0) throw new HttpError(409, `فقط ${pr.stock} عدد برای کاهش موجود بود، نه ${-b.delta} عدد`);
  const before = pr.stock; pr.stock += b.delta; move(pr.variantId, b.delta, b.reason || 'اصلاح دستی انبار', null, u.id);
  audit(u, 'inventory.adjust', 'ProductVariant', pr.variantId, { stock: before }, { stock: pr.stock }); persist(); return { ok: true, stock: pr.stock };
});
route('GET', '/api/admin/orders', req => { adminOnly(req, 'orders.write'); return db.orders.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 200).map(o => uiOrder(o, true)); });
route('GET', '/api/admin/orders/:id', (req, res, p) => { adminOnly(req, 'orders.write'); const o = db.orders.find(x => x.id === p.id || x.number === p.id); if (!o) throw new HttpError(404, 'سفارش پیدا نشد'); return uiOrder(o, true); });
route('PATCH', '/api/admin/orders/:id', (req, res, p, b) => {
  const u = adminOnly(req, 'orders.write'), o = db.orders.find(x => x.id === p.id || x.number === p.id); if (!o) throw new HttpError(404, 'سفارش پیدا نشد');
  if (!b || !ST[b.status]) throw bad('وضعیت نامعتبر است');
  if (!(TRANSITIONS[o.status] || []).includes(b.status)) throw new HttpError(409, `انتقال از «${o.status}» به «${b.status}» مجاز نیست`);
  const from = o.status; addEvent(o, b.status, roleName(u.roleKey), 'admin'); if (RESTOCK_ON.has(b.status)) restock(o, 'return');
  notifyUser(o.userId, `وضعیت سفارش ${o.number}`, `وضعیت به «${ST[b.status]}» تغییر کرد.`);
  audit(u, 'order.status_change', 'Order', o.id, { status: from }, { status: b.status }); persist(); return { ok: true, status: b.status };
});
route('GET', '/api/admin/customers', req => {
  adminOnly(req, 'customers.read');
  return db.users.filter(x => !x.deletedAt && !x.roleKey).map(x => { const os = db.orders.filter(o => o.userId === x.id), paid = os.filter(o => PAID_SET.includes(o.status)); return { id: x.id, name: x.name, phone: x.phone, mail: x.email, orders: os.length, spent: paid.reduce((a, o) => a + o.total, 0), createdAt: fmt(x.createdAt) }; });
});
const couponUi = c => ({ id: c.id, code: c.code, type: c.type, value: c.value, min: c.minSubtotal, max: c.maxDiscount, uses: c.usedCount, limit: c.usageLimit, active: c.active });
route('GET', '/api/admin/promos', req => { adminOnly(req, 'promos.write'); return db.coupons.map(couponUi); });
route('POST', '/api/admin/promos', (req, res, p, b) => {
  const u = adminOnly(req, 'promos.write');
  const code = String(b && b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,30}$/.test(code) || !['percent', 'fixed'].includes(b.type) || !Number.isInteger(b.value) || b.value <= 0 || (b.type === 'percent' && b.value > 100)) throw bad();
  if (db.coupons.some(c => c.code === code)) throw new HttpError(409, 'این کد قبلاً وجود دارد');
  const c = { id: uid('cp_'), code, type: b.type, value: b.value, minSubtotal: b.minSubtotal || 0, maxDiscount: b.maxDiscount || null, usageLimit: b.usageLimit || null, perUserLimit: b.perUserLimit || null, usedCount: 0, active: true, startsAt: null, endsAt: null };
  db.coupons.push(c); audit(u, 'coupon.create', 'Coupon', c.id, null, { code, type: c.type, value: c.value }); persist(); return couponUi(c);
});
route('PATCH', '/api/admin/promos/:id', (req, res, p, b) => {
  const u = adminOnly(req, 'promos.write'), c = db.coupons.find(x => x.id === p.id || x.code === p.id); if (!c) throw new HttpError(404, 'کد تخفیف پیدا نشد');
  const before = { active: c.active, value: c.value };
  if (b && typeof b.active === 'boolean') c.active = b.active; if (b && Number.isInteger(b.value) && b.value > 0) c.value = b.value;
  if (b && Number.isInteger(b.minSubtotal)) c.minSubtotal = b.minSubtotal; if (b && Number.isInteger(b.usageLimit)) c.usageLimit = b.usageLimit;
  audit(u, 'coupon.update', 'Coupon', c.id, before, { active: c.active, value: c.value }); persist(); return couponUi(c);
});
const reviewUi = r => ({ id: r.id, pid: r.productId, pname: (byId(r.productId) || {}).name || '—', by: r.by, stars: r.stars, text: r.text, status: r.status, adminReply: r.adminReply });
route('GET', '/api/admin/reviews', req => { adminOnly(req, 'reviews.moderate'); return db.reviews.slice().sort((a, b) => b.createdAt - a.createdAt).map(reviewUi); });
route('PATCH', '/api/admin/reviews/:id', (req, res, p, b) => {
  const u = adminOnly(req, 'reviews.moderate'), r = db.reviews.find(x => x.id === p.id); if (!r) throw new HttpError(404, 'نظر پیدا نشد');
  const before = { status: r.status }; if (b && ['approved', 'rejected'].includes(b.status)) r.status = b.status; if (b && b.adminReply !== undefined) r.adminReply = String(b.adminReply).slice(0, 1000);
  audit(u, 'review.moderate', 'Review', r.id, before, { status: r.status }); persist(); return reviewUi(r);
});
route('DELETE', '/api/admin/reviews/:id', (req, res, p) => {
  const u = adminOnly(req, 'reviews.moderate'), r = db.reviews.find(x => x.id === p.id); if (!r) throw new HttpError(404, 'نظر پیدا نشد');
  db.reviews = db.reviews.filter(x => x !== r); audit(u, 'review.delete', 'Review', r.id, { text: r.text }, null); persist(); return { ok: true };
});
route('GET', '/api/admin/tickets', req => { adminOnly(req, 'tickets.write'); return db.tickets.slice().sort((a, b) => b.ts - a.ts).map(t => ({ ...uiTicket(t, true), customer: (user(t.userId) || {}).name || '—' })); });
route('PATCH', '/api/admin/tickets/:id', (req, res, p, b) => {
  const u = adminOnly(req, 'tickets.write'), t = db.tickets.find(x => x.id === p.id); if (!t) throw new HttpError(404, 'تیکت پیدا نشد');
  const before = { status: t.status };
  if (b && b.reply) {
    const internal = !!b.internal; t.messages.push({ by: 'پشتیبانی', text: String(b.reply).slice(0, 2000), internal, ts: Date.now() });
    if (!internal) { if (!b.status) t.status = 'waiting_customer'; notifyUser(t.userId, 'پاسخ پشتیبانی', `تیکت «${t.subject}» پاسخ داده شد.`); }
  }
  if (b && b.status) { if (!TICKET_ST[b.status]) throw bad(); t.status = b.status; }
  audit(u, b && b.reply ? (b.internal ? 'ticket.internal_note' : 'ticket.reply') : 'ticket.status_change', 'Ticket', t.id, before, { status: t.status }); persist();
  return { ...uiTicket(t, true), customer: (user(t.userId) || {}).name || '—' };
});
route('GET', '/api/admin/content/articles', req => { adminOnly(req, 'content.write'); return db.articles.map(a => ({ id: a.id, title: a.title, cat: a.cat, read: a.read, published: !!a.publishedAt, reviewedBy: a.reviewedBy })); });
route('GET', '/api/admin/audit', (req, res, p, b, ip, sc, origin, q) => {
  adminOnly(req, 'audit.read'); const page = Math.max(1, +q.get('page') || 1), per = Math.min(100, +q.get('perPage') || 50);
  const rows = db.audit; return { logs: rows.slice((page - 1) * per, page * per).map(a => ({ id: a.id, who: a.who, action: a.action, entity: a.entity + ' ' + a.entityId, before: a.before == null ? '—' : JSON.stringify(a.before), after: a.after == null ? '—' : JSON.stringify(a.after), at: fmt(a.ts) })), page, perPage: per, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / per)) };
});
route('GET', '/api/admin/analytics', (req, res, p, b, ip, sc, origin, q) => {
  adminOnly(req, 'analytics.read'); const days = Math.min(90, Math.max(1, +q.get('days') || 30)), since = Date.now() - days * 86400000;
  const paid = db.orders.filter(o => PAID_SET.includes(o.status) && o.createdAt >= since), rev = paid.reduce((a, o) => a + o.total, 0);
  const sold = {}; for (const o of db.orders) if (PAID_SET.includes(o.status)) for (const i of o.items) sold[i.name] = (sold[i.name] || 0) + i.qty;
  const byCat = {}; for (const p2 of db.products) byCat[p2.cat] = (byCat[p2.cat] || 0) + p2.sold;
  return { rangeDays: days, revenue: rev, orders: paid.length, avgOrderValue: paid.length ? Math.round(rev / paid.length) : 0, newCustomers: db.users.filter(x => !x.roleKey && x.createdAt >= since).length, returningCustomers: db.users.filter(x => !x.roleKey && x.createdAt < since && db.orders.some(o => o.userId === x.id)).length, bestSellers: Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, n]) => ({ name, sold: n })), lowStock: db.products.filter(x => x.stock < 5).sort((a, b) => a.stock - b.stock).slice(0, 10).map(x => ({ id: x.id, name: x.name, stock: x.stock })), expiringSoon: db.products.filter(x => x.expiresAt && x.expiresAt < Date.now() + 30 * 86400000).map(x => ({ product: x.name, expiresAt: new Date(x.expiresAt).toISOString() })), salesByCategory: Object.entries(byCat).map(([cat, n]) => ({ cat, sold: n })) };
});

/* ───────────── HTTP plumbing ───────────── */
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname); if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(FRONT, rel); if (!file.startsWith(FRONT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    const h = { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    if (process.env.DEV_CSP !== '0') h['Content-Security-Policy'] = CSP;
    res.writeHead(200, h); res.end(buf);
  });
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'), origin = (req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers.host;
  if (!u.pathname.startsWith('/api/')) return serveStatic(req, res, u.pathname);
  const chunks = []; req.on('data', c => { chunks.push(c); if (Buffer.concat(chunks).length > 1e6) req.destroy(); });
  req.on('end', () => {
    const cookies = []; const setCookie = c => cookies.push(c);
    const send = (status, body, extra) => { const h = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extra || {}) }; if (cookies.length) h['Set-Cookie'] = cookies; res.writeHead(status, h); res.end(JSON.stringify(body)); };
    try {
      const r = routes.find(x => x.method === req.method && x.re.test(u.pathname));
      if (!r) {
        if (routes.some(x => x.re.test(u.pathname))) throw new HttpError(405, 'متد مجاز نیست');
        throw new HttpError(404, 'مسیر پیدا نشد');
      }
      let body = null; const raw = Buffer.concat(chunks).toString('utf8');
      if (raw) { try { body = JSON.parse(raw); } catch { throw bad('بدنهٔ درخواست JSON معتبر نیست'); } }
      const params = r.re.exec(u.pathname).groups || {}, ip = req.socket.remoteAddress || '?';
      const out = r.handler(req, res, params, body, ip, setCookie, origin, u.searchParams);
      if (out && out.__redirect) { res.writeHead(302, { Location: out.__redirect }); return res.end(); }
      send(200, out);
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message, ...e.extra });
      console.error(e); send(500, { error: 'خطای داخلی سرور' });
    }
  });
});
initDb();
if (require.main === module) {
  server.listen(PORT, () => console.log(`\n🌿 سبزدارو (سرور توسعه) → http://localhost:${PORT}\n   فرانت‌اند: ${FRONT}\n   ذخیره‌سازی: ${PERSIST || 'خاموش'}\n`));
}
module.exports = { server, initDb, get db() { return db; } };
