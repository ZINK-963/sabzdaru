// اجرای واقعی تست‌های خالص backend با tsx (بدون vitest/Next/Prisma): همان assertionهای tests/*.test.ts
import { effectiveSale } from "../backend/lib/sale";
import { ALLOWED_TRANSITIONS, RESTOCK_ON } from "../backend/lib/order-transitions";
import { createHmac } from "crypto";
let pass = 0, fail = 0; const t = (n: string, c: boolean) => { c ? pass++ : fail++; console.log((c ? "✓ " : "✗ ") + n); };
const day = 86400000, now = new Date("2026-10-10T12:00:00Z"); const v = (o: any) => ({ salePrice: 90, saleFrom: null, saleUntil: null, ...o });
t("sale: null price → null", effectiveSale(v({ salePrice: null }), now) === null);
t("sale: no window → active", effectiveSale(v({}), now) === 90);
t("sale: not started → null", effectiveSale(v({ saleFrom: new Date(+now + day) }), now) === null);
t("sale: ended → null", effectiveSale(v({ saleUntil: new Date(+now - day) }), now) === null);
t("sale: inside window → price", effectiveSale(v({ saleFrom: new Date(+now - day), saleUntil: new Date(+now + day) }), now) === 90);
t("sale: price 0 is still a sale", effectiveSale(v({ salePrice: 0 }), now) === 0);
const all = Object.keys(ALLOWED_TRANSITIONS);
t("transitions: every target is a known status", Object.values(ALLOWED_TRANSITIONS).flat().every((s) => all.includes(s)));
t("transitions: CANCELLED & REFUNDED terminal", ALLOWED_TRANSITIONS.CANCELLED.length === 0 && ALLOWED_TRANSITIONS.REFUNDED.length === 0);
t("transitions: no PENDING_PAYMENT → DELIVERED jump", !ALLOWED_TRANSITIONS.PENDING_PAYMENT.includes("DELIVERED"));
t("transitions: restock exactly on CANCELLED/RETURNED", RESTOCK_ON.has("CANCELLED") && RESTOCK_ON.has("RETURNED") && RESTOCK_ON.size === 2);
t("transitions: a paid order can still be cancelled, a shipped one cannot", ALLOWED_TRANSITIONS.PAID.includes("CANCELLED") && !ALLOWED_TRANSITIONS.SHIPPED.includes("CANCELLED"));
// HMAC verifier (still shipped for webhook-style gateways)
process.env.GATEWAY_SECRET = "s";
import("../backend/lib/gateway").then(({ verifyGatewaySignature, getPaymentGateway }) => {
  const p = { orderId: "o", gatewayRef: "r", amount: 5, status: "success" };
  const sig = createHmac("sha256", "s").update(`${p.orderId}:${p.gatewayRef}:${p.amount}:${p.status}`).digest("hex");
  t("hmac: valid accepted", verifyGatewaySignature({ ...p, signature: sig }));
  t("hmac: tampered amount rejected", !verifyGatewaySignature({ ...p, amount: 1, signature: sig }));
  t("hmac: garbage rejected without throwing", !verifyGatewaySignature({ ...p, signature: "zz" }));
  (async () => {
    process.env.NODE_ENV = "development"; delete process.env.PAYMENT_GATEWAY;
    const gw = getPaymentGateway(); const i = await gw.initiate({ orderId: "o", amount: 1, callbackUrl: "https://x/cb", description: "d", simulate: "fail" });
    t("sample gateway: simulate=fail → failure URL", /simulate=failure/.test(i.redirectUrl));
    t("sample gateway: verify(failure) → not success", !(await gw.verify({ gatewayRef: i.gatewayRef, amount: 1, query: { simulate: "failure" } })).success);
    const ok = await gw.initiate({ orderId: "o", amount: 1, callbackUrl: "https://x/cb", description: "d" });
    t("sample gateway: default → success URL", /simulate=success/.test(ok.redirectUrl));
    process.env.NODE_ENV = "production"; delete process.env.ALLOW_SAMPLE_GATEWAY;
    let threw = false; try { getPaymentGateway(); } catch { threw = true; }
    t("SECURITY: sample gateway REFUSES to run in production by default", threw);
    process.env.PAYMENT_GATEWAY = "zarinpal"; let z = true; try { getPaymentGateway(); } catch { z = false; }
    t("production + zarinpal selects the real gateway without throwing", z);
    console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
  })();
});
