import { afterEach, describe, it, expect, vi } from "vitest";
import { getSmsProvider } from "../lib/sms";

describe("SMS production safety", () => {
  it("never lets the console OTP provider run in production", async () => {
    const oldNode = process.env.NODE_ENV;
    const oldProvider = process.env.SMS_PROVIDER;
    try {
      process.env.NODE_ENV = "production";
      process.env.SMS_PROVIDER = "console";
      expect(() => getSmsProvider()).toThrow(/production/);
    } finally {
      if (oldNode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNode;
      if (oldProvider === undefined) delete process.env.SMS_PROVIDER; else process.env.SMS_PROVIDER = oldProvider;
    }
  });
});


describe("Kavenegar VerifyLookup response handling", () => {
  const keys = ["NODE_ENV", "SMS_PROVIDER", "KAVENEGAR_API_KEY", "KAVENEGAR_OTP_TEMPLATE"] as const;
  const before = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of keys) {
      const value = before[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  it("accepts Kavenegar's documented return.status=200 response", async () => {
    process.env.NODE_ENV = "test";
    process.env.SMS_PROVIDER = "kavenegar";
    process.env.KAVENEGAR_API_KEY = "test-key";
    process.env.KAVENEGAR_OTP_TEMPLATE = "registerverify";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ return: { status: 200 } }) }));
    await expect(getSmsProvider().sendOtp("09123456789", "123456")).resolves.toBeUndefined();
  });

  it("rejects an API business error even when HTTP status is 200", async () => {
    process.env.NODE_ENV = "test";
    process.env.SMS_PROVIDER = "kavenegar";
    process.env.KAVENEGAR_API_KEY = "test-key";
    process.env.KAVENEGAR_OTP_TEMPLATE = "registerverify";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ return: { status: 401, message: "invalid" } }) }));
    await expect(getSmsProvider().sendOtp("09123456789", "123456")).rejects.toThrow(/status 401/);
  });
});
