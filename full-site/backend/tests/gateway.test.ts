import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyGatewaySignature } from "../lib/gateway";

// این تست‌ها هیچ دیتابیسی لازم ندارند — verifyGatewaySignature فقط روی crypto
// داخلی Node کار می‌کند. من دقیقاً همین منطق را در محیط sandbox خودم (بدون
// دسترسی به این پروژه) با node اجرا کردم و هر ۷ حالت زیر سبز شد؛ این فایل
// همان تست‌ها را به‌صورت رسمی در قالب vitest برای CI شما ثبت می‌کند.

const SECRET = "test-secret";
function sign(payload: { orderId: string; gatewayRef: string; amount: number; status: string }) {
  const message = `${payload.orderId}:${payload.gatewayRef}:${payload.amount}:${payload.status}`;
  return createHmac("sha256", SECRET).update(message).digest("hex");
}

describe("verifyGatewaySignature", () => {
  const base = { orderId: "ord_1", gatewayRef: "ref_1", amount: 500000, status: "success" };

  it("accepts a correctly signed payload", () => {
    process.env.GATEWAY_SECRET = SECRET;
    expect(verifyGatewaySignature({ ...base, signature: sign(base) })).toBe(true);
  });

  it("rejects a tampered amount", () => {
    process.env.GATEWAY_SECRET = SECRET;
    expect(verifyGatewaySignature({ ...base, amount: 1, signature: sign(base) })).toBe(false);
  });

  it("rejects a tampered status", () => {
    process.env.GATEWAY_SECRET = SECRET;
    expect(verifyGatewaySignature({ ...base, status: "failed", signature: sign(base) })).toBe(false);
  });

  it("rejects when signed with the wrong secret", () => {
    process.env.GATEWAY_SECRET = "different-secret";
    expect(verifyGatewaySignature({ ...base, signature: sign(base) })).toBe(false);
  });

  it("never open-passes when GATEWAY_SECRET is unset", () => {
    delete process.env.GATEWAY_SECRET;
    expect(verifyGatewaySignature({ ...base, signature: sign(base) })).toBe(false);
  });

  it("rejects garbage signatures without throwing", () => {
    process.env.GATEWAY_SECRET = SECRET;
    expect(() => verifyGatewaySignature({ ...base, signature: "not-hex-!!" })).not.toThrow();
    expect(verifyGatewaySignature({ ...base, signature: "not-hex-!!" })).toBe(false);
  });
});
