import { describe, it, expect, beforeAll, afterAll } from "vitest";

/**
 * این فایل هنوز اجرا نشده — بر خلاف gateway.test.ts و order-transitions.test.ts
 * که منطق خالص هستند و در sandbox من (بدون دیتابیس) واقعاً اجرا و سبز شدند،
 * این تست‌ها به یک PostgreSQL واقعی نیاز دارند (checkout/place چند جدول را در
 * یک تراکنش با SELECT ... FOR UPDATE تغییر می‌دهد) که در محیط من موجود نیست.
 *
 * برای اجرا: یک دیتابیس تست جدا بسازید (یا از testcontainers استفاده کنید)،
 * DATABASE_URL را به آن اشاره دهید، migrate و seed را بزنید، سپس این فایل را
 * از پرانتز حذف کنید و اجرا کنید.
 */
describe.skip("checkout/place — real database required", () => {
  beforeAll(async () => {
    // TODO: پایگاه‌دادهٔ تست را migrate و seed کنید
  });

  it("rejects when requested quantity exceeds available stock", async () => {
    // TODO: یک واریانت با موجودی ۲ بسازید، ۵ عدد درخواست بدهید، انتظار 409 داشته باشید
    expect(true).toBe(true);
  });

  it("decrements stock exactly once even if the client double-submits", async () => {
    // TODO: همزمان دو درخواست place به یک سبد بزنید، مطمئن شوید فقط یکی موفق می‌شود
    // (قفل ردیفی SELECT...FOR UPDATE دقیقاً همین را تضمین می‌کند)
    expect(true).toBe(true);
  });

  it("payment callback is idempotent under retry", async () => {
    // TODO: همان callback را دوبار با یک gatewayRef بفرستید، انتظار داشته باشید
    // فقط یک رکورد Payment و یک OrderEvent ساخته شود
    expect(true).toBe(true);
  });

  it("coupon usage count never exceeds usageLimit under concurrent orders", async () => {
    // TODO: کوپنی با usageLimit=1 بسازید، دو سفارش همزمان با همان کد ثبت کنید
    expect(true).toBe(true);
  });

  afterAll(async () => {
    // TODO: پاک‌سازی دیتابیس تست
  });
});
