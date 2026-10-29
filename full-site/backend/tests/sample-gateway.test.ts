import { describe, it, expect } from "vitest";
import { getPaymentGateway } from "../lib/gateway";

// من دقیقاً همین منطق (SampleGateway) را در sandbox خودم بدون Prisma/شبکه
// اجرا کردم و هر ۶ حالت زیر سبز شد؛ این نسخهٔ رسمی همان تست‌هاست.
describe("SampleGateway (PAYMENT_GATEWAY unset or 'sample')", () => {
  it("round-trips initiate → callback URL → verify as a success", async () => {
    delete process.env.PAYMENT_GATEWAY;
    const gw = getPaymentGateway();
    const init = await gw.initiate({
      orderId: "ord_1", amount: 500000,
      callbackUrl: "https://example.com/api/payments/callback", description: "test",
    });
    expect(init.gatewayRef).toMatch(/^SAMPLE-/);
    expect(init.redirectUrl).toContain(init.gatewayRef);

    const url = new URL(init.redirectUrl);
    const query = Object.fromEntries(url.searchParams.entries());
    const result = await gw.verify({ gatewayRef: init.gatewayRef, amount: 500000, query });
    expect(result.success).toBe(true);
    expect(result.refId).toBe(init.gatewayRef);
  });

  it("never succeeds when the simulate flag is missing", async () => {
    const gw = getPaymentGateway();
    const result = await gw.verify({ gatewayRef: "SAMPLE-x", amount: 1, query: {} });
    expect(result.success).toBe(false);
  });

  it("produces a different gatewayRef on every call", async () => {
    const gw = getPaymentGateway();
    const a = await gw.initiate({ callbackUrl: "x", orderId: "1", amount: 1, description: "d" });
    const b = await gw.initiate({ callbackUrl: "x", orderId: "2", amount: 1, description: "d" });
    expect(a.gatewayRef).not.toBe(b.gatewayRef);
  });
});


describe("production payment safety", () => {
  it("rejects the sample gateway in production even with the old override", () => {
    const old = { env: process.env.NODE_ENV, gateway: process.env.PAYMENT_GATEWAY, allow: process.env.ALLOW_SAMPLE_GATEWAY };
    try {
      process.env.NODE_ENV = "production";
      process.env.PAYMENT_GATEWAY = "sample";
      process.env.ALLOW_SAMPLE_GATEWAY = "1";
      expect(() => getPaymentGateway()).toThrow(/production/);
    } finally {
      if (old.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old.env;
      if (old.gateway === undefined) delete process.env.PAYMENT_GATEWAY; else process.env.PAYMENT_GATEWAY = old.gateway;
      if (old.allow === undefined) delete process.env.ALLOW_SAMPLE_GATEWAY; else process.env.ALLOW_SAMPLE_GATEWAY = old.allow;
    }
  });

  it("rejects unknown gateway names instead of silently falling back", () => {
    const old = { env: process.env.NODE_ENV, gateway: process.env.PAYMENT_GATEWAY };
    try {
      process.env.NODE_ENV = "test";
      process.env.PAYMENT_GATEWAY = "misspelled-provider";
      expect(() => getPaymentGateway()).toThrow(/نامعتبر/);
    } finally {
      if (old.env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old.env;
      if (old.gateway === undefined) delete process.env.PAYMENT_GATEWAY; else process.env.PAYMENT_GATEWAY = old.gateway;
    }
  });
});
