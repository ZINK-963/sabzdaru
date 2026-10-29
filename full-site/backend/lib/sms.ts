/**
 * Kavenegar OTP provider. Console delivery is development-only: never leak OTPs
 * into production logs or silently pretend a message was sent.
 */
export interface SmsProvider {
  sendOtp(phone: string, code: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ارسال پیامک کنسولی در production ممنوع است؛ SMS_PROVIDER=kavenegar را تنظیم کنید");
    }
    console.log(`[DEV SMS] to ${phone}: کد ورود شما ${code} است`);
  }
}

class KavenegarProvider implements SmsProvider {
  async sendOtp(phone: string, code: string) {
    const apiKey = process.env.KAVENEGAR_API_KEY;
    const template = process.env.KAVENEGAR_OTP_TEMPLATE;
    if (!apiKey) throw new Error("KAVENEGAR_API_KEY تنظیم نشده");
    if (!template) throw new Error("KAVENEGAR_OTP_TEMPLATE تنظیم نشده");

    const url = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json`;
    const params = new URLSearchParams({ receptor: phone, token: code, template });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Kavenegar HTTP ${res.status}`);
      const body: any = await res.json().catch(() => null);
      // Kavenegar may return business errors inside an HTTP 200 response.
      if (Number(body?.return?.status) !== 200) {
        const codeValue = body?.return?.status ?? "unknown";
        throw new Error(`Kavenegar rejected the SMS (status ${codeValue})`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getSmsProvider(): SmsProvider {
  const kind = process.env.SMS_PROVIDER ?? "console";
  if (kind === "kavenegar") return new KavenegarProvider();
  if (kind === "console" && process.env.NODE_ENV !== "production") return new ConsoleSmsProvider();
  throw new Error("SMS_PROVIDER نامعتبر است؛ در production باید kavenegar باشد");
}
