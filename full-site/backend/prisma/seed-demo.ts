import type { PrismaClient } from "@prisma/client";
import { ROLE_NAMES } from "../lib/roles";

/**
 * seed دمو — برندها، ۲۸ محصول، کوپن‌ها و مقالات «ساختگی» (همه با isDemo=true) برای نمایش/تست.
 * عمداً در production اجرا نمی‌شود (مگر ALLOW_DEMO_SEED=1) و حتی اگر اجرا شود، فروشگاه آن‌ها را نشان نمی‌دهد.
 * قیمت‌ها، برندها، توضیحات و نام «بازبینی‌کنندهٔ مقالات» همه جای‌نگهدارند و باید با اطلاعات واقعی و تأییدشده جایگزین شوند.
 */
export async function seedDemo(prisma: PrismaClient, categories: Record<string, string>) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("seed دمو در production غیرمجاز است (داده‌های ساختگی نباید وارد فروشگاه واقعی شوند). برای نمایش آزمایشی ALLOW_DEMO_SEED=1 بگذارید.");
  }
  // ── برندها (همه ساختگی) ──
  const brands: Record<string, string> = {};
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b1" },
      create: { isDemo: true, slug: "b1", name: "سِروالیا", desc: "برند نمونهٔ مراقبت پوست. تمام اطلاعات این برند ساختگی است." },
      update: { name: "سِروالیا", desc: "برند نمونهٔ مراقبت پوست. تمام اطلاعات این برند ساختگی است." },
    });
    brands["b1"] = brand.id;
  }
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b2" },
      create: { isDemo: true, slug: "b2", name: "هلیودرم", desc: "برند نمونهٔ ضدآفتاب و مراقبت روزانه. اطلاعات ساختگی است." },
      update: { name: "هلیودرم", desc: "برند نمونهٔ ضدآفتاب و مراقبت روزانه. اطلاعات ساختگی است." },
    });
    brands["b2"] = brand.id;
  }
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b3" },
      create: { isDemo: true, slug: "b3", name: "ویتالیف", desc: "برند نمونهٔ مکمل و ویتامین. اطلاعات ساختگی است." },
      update: { name: "ویتالیف", desc: "برند نمونهٔ مکمل و ویتامین. اطلاعات ساختگی است." },
    });
    brands["b3"] = brand.id;
  }
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b4" },
      create: { isDemo: true, slug: "b4", name: "کراتیوا", desc: "برند نمونهٔ مراقبت مو. اطلاعات ساختگی است." },
      update: { name: "کراتیوا", desc: "برند نمونهٔ مراقبت مو. اطلاعات ساختگی است." },
    });
    brands["b4"] = brand.id;
  }
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b5" },
      create: { isDemo: true, slug: "b5", name: "مدیسن", desc: "برند نمونهٔ تجهیزات سلامت خانگی. اطلاعات ساختگی است." },
      update: { name: "مدیسن", desc: "برند نمونهٔ تجهیزات سلامت خانگی. اطلاعات ساختگی است." },
    });
    brands["b5"] = brand.id;
  }
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b6" },
      create: { isDemo: true, slug: "b6", name: "بِبه‌کر", desc: "برند نمونهٔ مادر و کودک. اطلاعات ساختگی است." },
      update: { name: "بِبه‌کر", desc: "برند نمونهٔ مادر و کودک. اطلاعات ساختگی است." },
    });
    brands["b6"] = brand.id;
  }
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b7" },
      create: { isDemo: true, slug: "b7", name: "دنتیس", desc: "برند نمونهٔ بهداشت دهان. اطلاعات ساختگی است." },
      update: { name: "دنتیس", desc: "برند نمونهٔ بهداشت دهان. اطلاعات ساختگی است." },
    });
    brands["b7"] = brand.id;
  }
  {
    const brand = await prisma.brand.upsert({
      where: { slug: "b8" },
      create: { isDemo: true, slug: "b8", name: "نوکتورن", desc: "برند نمونهٔ آرامش و خواب. اطلاعات ساختگی است." },
      update: { name: "نوکتورن", desc: "برند نمونهٔ آرامش و خواب. اطلاعات ساختگی است." },
    });
    brands["b8"] = brand.id;
  }

  
  // ── ۲۸ محصول نمایشی، دقیقاً همان‌هایی که فرانت‌اند محلی نشان می‌دهد ──
  const tenMonthsFromNow = new Date(Date.now() + 10 * 30 * 86400000);
  const products: Record<string, string> = {};
  {
    const product = await prisma.product.upsert({
      where: { slug: "skin-1" },
      create: {
        isDemo: true, slug: "skin-1", name: "کرم آبرسان صورت", published: true,
        categoryId: categories["skin"], brandId: brands["b1"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"skinType\": \"خشک\", \"form\": \"کرم\", \"size\": \"۵۰ تا ۲۰۰\", \"feature\": \"بدون عطر\"}"),
        variants: { create: [{
          sku: "SKU-P1", label: "پوست خشک · ۵۰ میلی‌لیتر", price: 380000, 
          batches: { create: [{ code: "B-p1", quantity: 24, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "کرم آبرسان صورت", published: true },
    });
    products["p1"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "skin-2" },
      create: {
        isDemo: true, slug: "skin-2", name: "ضدآفتاب بی‌رنگ SPF ۵۰", published: true,
        categoryId: categories["skin"], brandId: brands["b2"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"skinType\": \"مختلط\", \"form\": \"ژل\", \"spf\": \"۵۰\", \"size\": \"زیر ۵۰\", \"feature\": \"غیرکومدون‌زا\"}"),
        variants: { create: [{
          sku: "SKU-P2", label: "۴۰ میلی‌لیتر", price: 520000, salePrice: 442000,
          batches: { create: [{ code: "B-p2", quantity: 12, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "ضدآفتاب بی‌رنگ SPF ۵۰", published: true },
    });
    products["p2"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "skin-3" },
      create: {
        isDemo: true, slug: "skin-3", name: "سرم ویتامین C", published: true,
        categoryId: categories["skin"], brandId: brands["b1"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"skinType\": \"معمولی\", \"form\": \"سرم\", \"size\": \"زیر ۵۰\", \"feature\": \"وگان\"}"),
        variants: { create: [{
          sku: "SKU-P3", label: "۳۰ میلی‌لیتر", price: 640000, 
          batches: { create: [{ code: "B-p3", quantity: 8, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "سرم ویتامین C", published: true },
    });
    products["p3"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "skin-4" },
      create: {
        isDemo: true, slug: "skin-4", name: "ژل شست‌وشوی ملایم", published: true,
        categoryId: categories["skin"], brandId: brands["b2"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"skinType\": \"حساس\", \"form\": \"ژل\", \"size\": \"۵۰ تا ۲۰۰\", \"feature\": \"مناسب پوست حساس\"}"),
        variants: { create: [{
          sku: "SKU-P4", label: "۲۰۰ میلی‌لیتر", price: 245000, 
          batches: { create: [{ code: "B-p4", quantity: 40, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "ژل شست‌وشوی ملایم", published: true },
    });
    products["p4"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "skin-5" },
      create: {
        isDemo: true, slug: "skin-5", name: "کرم مرطوب‌کنندهٔ شب", published: true,
        categoryId: categories["skin"], brandId: brands["b1"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"skinType\": \"خشک\", \"form\": \"کرم\", \"size\": \"۵۰ تا ۲۰۰\", \"feature\": \"بدون عطر\"}"),
        variants: { create: [{
          sku: "SKU-P5", label: "۵۰ میلی‌لیتر", price: 495000, 
          batches: { create: [{ code: "B-p5", quantity: 2, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "کرم مرطوب‌کنندهٔ شب", published: true },
    });
    products["p5"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "skin-6" },
      create: {
        isDemo: true, slug: "skin-6", name: "ضدآفتاب فیزیکی SPF ۵۰+", published: true,
        categoryId: categories["skin"], brandId: brands["b2"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"skinType\": \"حساس\", \"form\": \"کرم\", \"spf\": \"۵۰+\", \"size\": \"۵۰ تا ۲۰۰\", \"feature\": \"مناسب پوست حساس\"}"),
        variants: { create: [{
          sku: "SKU-P6", label: "۵۰ میلی‌لیتر", price: 610000, 
          batches: { create: [{ code: "B-p6", quantity: 0, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "ضدآفتاب فیزیکی SPF ۵۰+", published: true },
    });
    products["p6"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "hair-1" },
      create: {
        isDemo: true, slug: "hair-1", name: "شامپو بدون سولفات", published: true,
        categoryId: categories["hair"], brandId: brands["b4"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"hairType\": \"رنگ‌شده\", \"scalp\": \"معمولی\", \"form\": \"ژل\", \"size\": \"بالای ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P7", label: "موی رنگ‌شده · ۴۰۰ میلی‌لیتر", price: 310000, 
          batches: { create: [{ code: "B-p7", quantity: 33, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "شامپو بدون سولفات", published: true },
    });
    products["p7"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "hair-2" },
      create: {
        isDemo: true, slug: "hair-2", name: "ماسک موی ترمیم‌کننده", published: true,
        categoryId: categories["hair"], brandId: brands["b4"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"hairType\": \"آسیب‌دیده\", \"scalp\": \"معمولی\", \"form\": \"کرم\", \"size\": \"۵۰ تا ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P8", label: "۲۰۰ میلی‌لیتر", price: 465000, 
          batches: { create: [{ code: "B-p8", quantity: 17, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "ماسک موی ترمیم‌کننده", published: true },
    });
    products["p8"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "hair-3" },
      create: {
        isDemo: true, slug: "hair-3", name: "سرم محافظ حرارتی", published: true,
        categoryId: categories["hair"], brandId: brands["b4"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"hairType\": \"خشک\", \"scalp\": \"معمولی\", \"form\": \"سرم\", \"size\": \"۵۰ تا ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P9", label: "۱۰۰ میلی‌لیتر", price: 390000, 
          batches: { create: [{ code: "B-p9", quantity: 21, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "سرم محافظ حرارتی", published: true },
    });
    products["p9"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "hair-4" },
      create: {
        isDemo: true, slug: "hair-4", name: "شامپو ضدشورهٔ روزانه", published: true,
        categoryId: categories["hair"], brandId: brands["b4"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"hairType\": \"چرب\", \"scalp\": \"شوره‌دار\", \"form\": \"ژل\", \"size\": \"بالای ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P10", label: "۳۰۰ میلی‌لیتر", price: 285000, salePrice: 242000,
          batches: { create: [{ code: "B-p10", quantity: 26, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "شامپو ضدشورهٔ روزانه", published: true },
    });
    products["p10"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "supp-1" },
      create: {
        isDemo: true, slug: "supp-1", name: "ویتامین D۳ ۱۰۰۰ واحد", published: true,
        categoryId: categories["supp"], brandId: brands["b3"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"قرص\", \"pack\": \"۶۰ عددی\", \"feature\": \"وگان\"}"),
        variants: { create: [{
          sku: "SKU-P11", label: "۶۰ قرص", price: 265000, 
          batches: { create: [{ code: "B-p11", quantity: 3, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "ویتامین D۳ ۱۰۰۰ واحد", published: true },
    });
    products["p11"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "supp-2" },
      create: {
        isDemo: true, slug: "supp-2", name: "مولتی‌ویتامین روزانه", published: true,
        categoryId: categories["supp"], brandId: brands["b3"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"قرص\", \"pack\": \"۳۰ عددی\"}"),
        variants: { create: [{
          sku: "SKU-P12", label: "۳۰ قرص", price: 410000, 
          batches: { create: [{ code: "B-p12", quantity: 55, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "مولتی‌ویتامین روزانه", published: true },
    });
    products["p12"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "supp-3" },
      create: {
        isDemo: true, slug: "supp-3", name: "امگا ۳", published: true,
        categoryId: categories["supp"], brandId: brands["b3"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"کپسول\", \"pack\": \"۹۰ عددی\"}"),
        variants: { create: [{
          sku: "SKU-P13", label: "۹۰ کپسول", price: 690000, salePrice: 586000,
          batches: { create: [{ code: "B-p13", quantity: 19, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "امگا ۳", published: true },
    });
    products["p13"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "supp-4" },
      create: {
        isDemo: true, slug: "supp-4", name: "منیزیم و ب۶", published: true,
        categoryId: categories["supp"], brandId: brands["b3"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"قرص\", \"pack\": \"۶۰ عددی\"}"),
        variants: { create: [{
          sku: "SKU-P14", label: "۶۰ قرص", price: 345000, 
          batches: { create: [{ code: "B-p14", quantity: 14, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "منیزیم و ب۶", published: true },
    });
    products["p14"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "supp-5" },
      create: {
        isDemo: true, slug: "supp-5", name: "ویتامین C جوشان", published: true,
        categoryId: categories["supp"], brandId: brands["b3"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"قرص\", \"pack\": \"۳۰ عددی\"}"),
        variants: { create: [{
          sku: "SKU-P15", label: "۲۰ قرص", price: 135000, 
          batches: { create: [{ code: "B-p15", quantity: 48, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "ویتامین C جوشان", published: true },
    });
    products["p15"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "hygiene-1" },
      create: {
        isDemo: true, slug: "hygiene-1", name: "خمیردندان روزانه", published: true,
        categoryId: categories["hygiene"], brandId: brands["b7"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"ژل\", \"size\": \"۵۰ تا ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P16", label: "۷۵ میلی‌لیتر", price: 98000, 
          batches: { create: [{ code: "B-p16", quantity: 120, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "خمیردندان روزانه", published: true },
    });
    products["p16"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "hygiene-2" },
      create: {
        isDemo: true, slug: "hygiene-2", name: "دهان‌شویهٔ بدون الکل", published: true,
        categoryId: categories["hygiene"], brandId: brands["b7"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"اسپری\", \"size\": \"بالای ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P17", label: "۵۰۰ میلی‌لیتر", price: 165000, 
          batches: { create: [{ code: "B-p17", quantity: 60, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "دهان‌شویهٔ بدون الکل", published: true },
    });
    products["p17"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "hygiene-3" },
      create: {
        isDemo: true, slug: "hygiene-3", name: "ژل ضدعفونی دست", published: true,
        categoryId: categories["hygiene"], brandId: brands["b1"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"ژل\", \"size\": \"۵۰ تا ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P18", label: "۱۰۰ میلی‌لیتر", price: 85000, 
          batches: { create: [{ code: "B-p18", quantity: 200, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "ژل ضدعفونی دست", published: true },
    });
    products["p18"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "baby-1" },
      create: {
        isDemo: true, slug: "baby-1", name: "لوسیون بدن کودک", published: true,
        categoryId: categories["baby"], brandId: brands["b6"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"age\": \"نوزاد\", \"form\": \"لوسیون\", \"size\": \"۵۰ تا ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P19", label: "۲۰۰ میلی‌لیتر", price: 220000, salePrice: 195000,
          batches: { create: [{ code: "B-p19", quantity: 35, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "لوسیون بدن کودک", published: true },
    });
    products["p19"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "baby-2" },
      create: {
        isDemo: true, slug: "baby-2", name: "شامپو بدون اشک", published: true,
        categoryId: categories["baby"], brandId: brands["b6"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"age\": \"۶ ماه به بالا\", \"form\": \"ژل\", \"size\": \"بالای ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P20", label: "۳۰۰ میلی‌لیتر", price: 190000, 
          batches: { create: [{ code: "B-p20", quantity: 44, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "شامپو بدون اشک", published: true },
    });
    products["p20"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "baby-3" },
      create: {
        isDemo: true, slug: "baby-3", name: "کرم مراقبت پوشک", published: true,
        categoryId: categories["baby"], brandId: brands["b6"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"age\": \"نوزاد\", \"form\": \"کرم\", \"size\": \"۵۰ تا ۲۰۰\"}"),
        variants: { create: [{
          sku: "SKU-P21", label: "۱۰۰ میلی‌لیتر", price: 175000, 
          batches: { create: [{ code: "B-p21", quantity: 5, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "کرم مراقبت پوشک", published: true },
    });
    products["p21"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "device-1" },
      create: {
        isDemo: true, slug: "device-1", name: "فشارسنج بازویی دیجیتال", published: true,
        categoryId: categories["device"], brandId: brands["b5"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"deviceType\": \"فشارسنج\", \"warranty\": \"۲ ساله\"}"),
        variants: { create: [{
          sku: "SKU-P22", label: "حافظهٔ ۲ کاربر", price: 2480000, 
          batches: { create: [{ code: "B-p22", quantity: 6, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "فشارسنج بازویی دیجیتال", published: true },
    });
    products["p22"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "device-2" },
      create: {
        isDemo: true, slug: "device-2", name: "تب‌سنج غیرتماسی", published: true,
        categoryId: categories["device"], brandId: brands["b5"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"deviceType\": \"تب‌سنج\", \"warranty\": \"۱ ساله\"}"),
        variants: { create: [{
          sku: "SKU-P23", label: "مادون قرمز", price: 890000, 
          batches: { create: [{ code: "B-p23", quantity: 11, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "تب‌سنج غیرتماسی", published: true },
    });
    products["p23"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "device-3" },
      create: {
        isDemo: true, slug: "device-3", name: "گلوکومتر خانگی", published: true,
        categoryId: categories["device"], brandId: brands["b5"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"deviceType\": \"گلوکومتر\", \"warranty\": \"۲ ساله\"}"),
        variants: { create: [{
          sku: "SKU-P24", label: "به‌همراه ۲۵ نوار", price: 1650000, 
          batches: { create: [{ code: "B-p24", quantity: 4, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "گلوکومتر خانگی", published: true },
    });
    products["p24"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "daily-1" },
      create: {
        isDemo: true, slug: "daily-1", name: "بستهٔ کمک‌های اولیه", published: true,
        categoryId: categories["daily"], brandId: brands["b1"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"بسته\"}"),
        variants: { create: [{
          sku: "SKU-P25", label: "۲۴ قلم", price: 290000, 
          batches: { create: [{ code: "B-p25", quantity: 18, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "بستهٔ کمک‌های اولیه", published: true },
    });
    products["p25"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "daily-2" },
      create: {
        isDemo: true, slug: "daily-2", name: "محلول شست‌وشوی چشم", published: true,
        categoryId: categories["daily"], brandId: brands["b3"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"اسپری\"}"),
        variants: { create: [{
          sku: "SKU-P26", label: "۱۰۰ میلی‌لیتر", price: 140000, 
          batches: { create: [{ code: "B-p26", quantity: 27, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "محلول شست‌وشوی چشم", published: true },
    });
    products["p26"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "sleep-1" },
      create: {
        isDemo: true, slug: "sleep-1", name: "مکمل منیزیم شب", published: true,
        categoryId: categories["sleep"], brandId: brands["b8"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"کپسول\"}"),
        variants: { create: [{
          sku: "SKU-P27", label: "۳۰ کپسول", price: 345000, 
          batches: { create: [{ code: "B-p27", quantity: 0, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "مکمل منیزیم شب", published: true },
    });
    products["p27"] = product.id;
  }
  {
    const product = await prisma.product.upsert({
      where: { slug: "sleep-2" },
      create: {
        isDemo: true, slug: "sleep-2", name: "اسپری بالش آرام‌بخش", published: true,
        categoryId: categories["sleep"], brandId: brands["b8"],
        description: "این توضیح نمونه است و برای نمایش ساختار صفحه نوشته شده. در نسخهٔ واقعی، متن از اطلاعات رسمی تولیدکننده وارد می‌شود.", usage: "طبق دستور مصرف درج‌شده روی بستهٔ محصول استفاده شود.", storage: "در دمای اتاق، دور از نور مستقیم و رطوبت نگهداری شود.",
        warnings: "در صورت بروز حساسیت مصرف را قطع کنید. دور از دسترس کودکان نگه دارید.", ingredients: "فهرست ترکیبات در نسخهٔ واقعی از برچسب رسمی محصول درج می‌شود؛ در این نسخهٔ نمایشی ساختگی نوشته نشده است.",
        attributes: JSON.parse("{\"form\": \"اسپری\"}"),
        variants: { create: [{
          sku: "SKU-P28", label: "۵۰ میلی‌لیتر", price: 280000, 
          batches: { create: [{ code: "B-p28", quantity: 22, expiresAt: tenMonthsFromNow }] },
        }] },
      },
      update: { name: "اسپری بالش آرام‌بخش", published: true },
    });
    products["p28"] = product.id;
  }


  
  // ── کدهای تخفیف نمونه ──
  const COUPONS = [{"code": "SABZ10", "type": "percent", "value": 10, "minSubtotal": 0, "maxDiscount": 200000, "usageLimit": 100, "active": true}, {"code": "WELCOME50", "type": "fixed", "value": 50000, "minSubtotal": 500000, "maxDiscount": null, "usageLimit": 50, "active": true}, {"code": "SPRING24", "type": "percent", "value": 15, "minSubtotal": 0, "maxDiscount": 300000, "usageLimit": null, "active": false, "endsAt": new Date(Date.now() - 86400000)}];
  for (const c of COUPONS) {
    await prisma.coupon.upsert({ where: { code: c.code }, create: { ...c, isDemo: true }, update: {} });
  }

  
  // ── مقالات نمونه. «بازبینی‌کننده» جای‌نگهدار است؛ پیش از انتشار واقعی باید نام کارشناس واقعی جایگزین شود (§31) ──
  const ARTICLES = [{"slug": "a1", "title": "ضدآفتاب را چطور و چقدر استفاده کنیم", "category": "راهنمای محصول", "readTime": 6, "tags": ["skin"], "body": "مقدار کافی، زمان تمدید و تفاوت فرم‌های ژلی، کرمی و فیزیکی. این متن نمونه است و در نسخهٔ واقعی باید با ارجاع به منابع معتبر و بازبینی کارشناس منتشر شود."}, {"slug": "a2", "title": "نگهداری مکمل‌ها در خانه", "category": "نگهداری", "readTime": 4, "tags": ["supp"], "body": "دما، رطوبت و تاریخ انقضا؛ چه چیزی را کجا نگه داریم. این متن نمونه است."}, {"slug": "a3", "title": "فشارسنج خانگی را درست بخوانید", "category": "تجهیزات", "readTime": 7, "tags": ["device"], "body": "شرایط اندازه‌گیری، محل بستن بازوبند و ثبت نتیجه. این متن نمونه است."}, {"slug": "a4", "title": "روتین ساده برای موی رنگ‌شده", "category": "مراقبت مو", "readTime": 5, "tags": ["hair"], "body": "شست‌وشوی ملایم و ترمیم رطوبت. این متن نمونه است."}, {"slug": "a5", "title": "تفاوت فرم‌های مکمل: قرص، کپسول، جوشان", "category": "آموزش", "readTime": 5, "tags": ["supp"], "body": "این متن نمونه است و صرفاً جنبهٔ آموزشی دارد."}, {"slug": "a6", "title": "پوست حساس و انتخاب پاک‌کننده", "category": "مراقبت پوست", "readTime": 6, "tags": ["skin"], "body": "این متن نمونه است و صرفاً جنبهٔ آموزشی دارد."}];
  for (const a of ARTICLES) {
    await prisma.article.upsert({ where: { slug: a.slug }, create: { ...a, isDemo: true, publishedAt: new Date(), reviewedBy: "تیم محتوای سبزدارو (نمونه)" }, update: {} });
  }

  
  // ── مشتری و نظر نمونه ──
  const sample = await prisma.user.upsert({ where: { phone: "09100000000" }, create: { phone: "09100000000", name: "کاربر نمونه" }, update: {} });
  const first = await prisma.product.findFirst({ where: { isDemo: true }, orderBy: { createdAt: "asc" } });
  if (first && !(await prisma.review.findUnique({ where: { productId_userId: { productId: first.id, userId: sample.id } } }))) {
    await prisma.review.create({ data: { productId: first.id, userId: sample.id, rating: 5, body: "این یک نظر نمونه برای نمایش ساختار صفحه است و از مشتری واقعی نیست.", status: "approved", verified: true, helpful: 3 } });
  }

  // ── حساب‌های دموی نقش‌ها (فقط خارج از production) ──
  const DEMO_ADMINS: Record<string, string> = { "09120000000": "super", "09120000001": "store", "09120000002": "inv", "09120000003": "support", "09120000004": "content", "09120000005": "finance" };
  for (const [phone, roleKey] of Object.entries(DEMO_ADMINS)) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (role) await prisma.user.upsert({ where: { phone }, create: { phone, name: ROLE_NAMES[roleKey] ?? roleKey, roleId: role.id }, update: { roleId: role.id } });
  }
  console.log("demo seed complete:", Object.keys(brands).length, "brands,", Object.keys(products).length, "products");
}
