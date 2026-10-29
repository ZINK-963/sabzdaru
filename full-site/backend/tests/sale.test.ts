import { describe, it, expect } from "vitest";
import { effectiveSale } from "../lib/sale";

const day = 86400000, now = new Date("2026-10-10T12:00:00Z");
const v = (o: Partial<{ salePrice: number | null; saleFrom: Date | null; saleUntil: Date | null }>) => ({ salePrice: 90, saleFrom: null, saleUntil: null, ...o });

describe("effectiveSale — حراج فقط داخل بازهٔ زمانی خودش معتبر است", () => {
  it("بدون قیمت حراج → null", () => expect(effectiveSale(v({ salePrice: null }), now)).toBeNull());
  it("حراج بدون بازه همیشه فعال است", () => expect(effectiveSale(v({}), now)).toBe(90));
  it("هنوز شروع نشده → null", () => expect(effectiveSale(v({ saleFrom: new Date(+now + day) }), now)).toBeNull());
  it("تمام شده → null", () => expect(effectiveSale(v({ saleUntil: new Date(+now - day) }), now)).toBeNull());
  it("داخل بازه → قیمت حراج", () => expect(effectiveSale(v({ saleFrom: new Date(+now - day), saleUntil: new Date(+now + day) }), now)).toBe(90));
  it("قیمت حراج صفر هم «حراج» حساب می‌شود (null نیست)", () => expect(effectiveSale(v({ salePrice: 0 }), now)).toBe(0));
});
