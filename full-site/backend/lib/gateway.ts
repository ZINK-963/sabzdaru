import { createHmac, timingSafeEqual, randomBytes } from "crypto";

/**
 * نسخهٔ اول این فایل فقط یک verifyGatewaySignature با HMAC داشت — طراحی‌اش
 * فرض می‌کرد درگاه با POST+امضا به ما callback می‌زند. این فرض اشتباه بود:
 * درگاه‌های واقعی ایرانی (زرین‌پال و مشابه) اینطور کار نمی‌کنند؛ آن‌ها مرورگر
 * مشتری را با GET و چند query param به callback_url برمی‌گردانند، و تأیید
 * واقعی با یک فراخوان مستقیم سرور-به-سرور به API تأیید خودِ درگاه انجام می‌شود
 * (که چون مستقیم HTTPS است، نیازی به امضا ندارد — اعتماد از همان اتصال می‌آید).
 * verifyGatewaySignature را نگه داشته‌ام چون بعضی درگاه‌ها (نه زرین‌پال) واقعاً
 * webhook با امضا دارند، اما دیگر مسیر اصلی نیست.
 */
export function verifyGatewaySignature(payload: {
  orderId: string;
  gatewayRef: string;
  amount: number;
  status: string;
  signature: string;
}): boolean {
  const secret = process.env.GATEWAY_SECRET;
  if (!secret) {
    console.error("GATEWAY_SECRET تنظیم نشده؛ همهٔ callbackهای امضادار رد می‌شوند");
    return false;
  }
  const message = `${payload.orderId}:${payload.gatewayRef}:${payload.amount}:${payload.status}`;
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(payload.signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface PaymentGateway {
  /** کاربر را برای پرداخت به بانک می‌فرستد؛ یک گیرندهٔ تراکنش (authority/gatewayRef) برمی‌گرداند. */
  initiate(params: {
    orderId: string;
    amount: number; // تومان
    callbackUrl: string;
    description: string;
    /** فقط برای درگاه آزمایشی (sample): "fail" → نتیجهٔ ناموفق؛ درگاه واقعی آن را نادیده می‌گیرد */
    simulate?: string;
  }): Promise<{ redirectUrl: string; gatewayRef: string }>;

  /** بعد از بازگشت کاربر، واقعاً نتیجه را از خودِ درگاه تأیید می‌کند — نه از چیزی که کاربر در URL آورده. */
  verify(params: {
    gatewayRef: string;
    amount: number;
    query: Record<string, string>;
  }): Promise<{ success: boolean; refId?: string }>;
}

/**
 * برای توسعهٔ محلی بدون حساب بانکی واقعی. initiate مستقیم کاربر را به همان
 * callback خودمان برمی‌گرداند با یک پرچم شبیه‌سازی‌شده — هیچ بانک واقعی در کار نیست.
 */
class SampleGateway implements PaymentGateway {
  async initiate({ callbackUrl, simulate }: { callbackUrl: string; simulate?: string }) {
    const gatewayRef = "SAMPLE-" + randomBytes(8).toString("hex");
    const outcome = simulate === "fail" ? "failure" : "success";
    return { redirectUrl: `${callbackUrl}?gatewayRef=${gatewayRef}&simulate=${outcome}`, gatewayRef };
  }
  async verify({ gatewayRef, query }: { gatewayRef: string; query: Record<string, string> }) {
    return { success: query.simulate === "success", refId: gatewayRef };
  }
}

/**
 * الگوی واقعی زرین‌پال (REST v4). برای فعال‌سازی: PAYMENT_GATEWAY=zarinpal و
 * ZARINPAL_MERCHANT_ID در .env. من این را هرگز با حساب واقعی زرین‌پال تست
 * نکرده‌ام — مستندات رسمی‌شان را قبل از production دوباره چک کنید، مخصوصاً
 * واحد مبلغ (آن‌ها ریال می‌خواهند، ما تومان نگه می‌داریم، برای همین ×۱۰ هست).
 */
class ZarinpalGateway implements PaymentGateway {
  private merchantId() {
    const id = process.env.ZARINPAL_MERCHANT_ID;
    if (!id) throw new Error("ZARINPAL_MERCHANT_ID تنظیم نشده");
    return id;
  }

  async initiate({ amount, callbackUrl, description }: { amount: number; callbackUrl: string; description: string }) {
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("مبلغ پرداخت نامعتبر است");
    const res = await fetch("https://api.zarinpal.com/pg/v4/payment/request.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchant_id: this.merchantId(),
        amount: amount * 10, // مبلغ‌های پروژه تومان هستند؛ API زرین‌پال ریال می‌خواهد.
        callback_url: callbackUrl,
        description: description.slice(0, 255),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => null);
    const authority = data?.data?.authority;
    const code = Number(data?.data?.code);
    if (!res.ok || !authority || code !== 100) {
      // Never log or return merchant credentials; only safe gateway response codes.
      throw new Error(`درخواست پرداخت زرین‌پال رد شد (HTTP ${res.status}, code ${Number.isFinite(code) ? code : "unknown"})`);
    }
    return { redirectUrl: `https://www.zarinpal.com/pg/StartPay/${authority}`, gatewayRef: authority };
  }

  async verify({ gatewayRef, amount, query }: { gatewayRef: string; amount: number; query: Record<string, string> }) {
    // Zarinpal redirects with Status=NOK when the customer cancels. Do not call it a paid order.
    if (String(query.Status ?? "").toUpperCase() !== "OK") return { success: false };
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("مبلغ پرداخت نامعتبر است");
    const res = await fetch("https://api.zarinpal.com/pg/v4/payment/verify.json", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ merchant_id: this.merchantId(), amount: amount * 10, authority: gatewayRef }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`تأیید زرین‌پال ناموفق بود (HTTP ${res.status})`);
    const code = Number(data?.data?.code);
    const success = code === 100 || code === 101; // 101 = قبلاً تأییدشده (idempotent)
    return { success, refId: data?.data?.ref_id != null ? String(data.data.ref_id) : undefined };
  }
}

export function gatewayKind(): string {
  return process.env.PAYMENT_GATEWAY ?? "sample";
}

export function getPaymentGateway(): PaymentGateway {
  const kind = gatewayKind();
  if (kind === "zarinpal") return new ZarinpalGateway();
  if (kind !== "sample") throw new Error("PAYMENT_GATEWAY نامعتبر است");
  // Never allow the URL-driven sample gateway in production, even with an override.
  if (process.env.NODE_ENV === "production") {
    throw new Error("درگاه آزمایشی در production ممنوع است؛ PAYMENT_GATEWAY=zarinpal را تنظیم کنید");
  }
  return new SampleGateway();
}
