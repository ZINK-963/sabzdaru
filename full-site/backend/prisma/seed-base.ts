import type { PrismaClient } from "@prisma/client";
import { ROLE_NAMES, ROLE_PERMISSIONS } from "../lib/roles";

/**
 * seed پایه — چیزهایی که خودِ سیستم برای کار کردن لازم دارد (بدون هیچ محصول/برند/قیمت نمایشی):
 * مجوزها و نقش‌ها، ساختار دسته‌ها و فیلترهای اختصاصی هر دسته، روش‌های ارسال، و حساب مدیر ارشد (ADMIN_PHONE).
 * کاملاً تکرارپذیر است (upsert) و داده‌ٔ تکراری نمی‌سازد؛ هیچ چیز را حذف نمی‌کند.
 */
export async function seedBase(prisma: PrismaClient): Promise<{ categories: Record<string, string> }> {
  const PERMISSIONS = [...new Set(Object.values(ROLE_PERMISSIONS).flat())].filter((k) => k !== "*");
  const permRecords = await Promise.all(PERMISSIONS.map((key) => prisma.permission.upsert({ where: { key }, create: { key }, update: {} })));
  const starPerm = await prisma.permission.upsert({ where: { key: "*" }, create: { key: "*" }, update: {} });
  for (const [key, keys] of Object.entries(ROLE_PERMISSIONS)) {
    const connect = keys.includes("*") ? [{ id: starPerm.id }] : permRecords.filter((p: any) => keys.includes(p.key)).map((p: any) => ({ id: p.id }));
    await prisma.role.upsert({ where: { key }, create: { key, name: ROLE_NAMES[key] ?? key, permissions: { connect } }, update: { name: ROLE_NAMES[key] ?? key, permissions: { set: connect } } });
  }

  // ── دسته‌ها + فیلترهای اختصاصی هر دسته (§9) ──
  const categories: Record<string, string> = {};
  {
    const cat = await prisma.category.upsert({
      where: { slug: "skin" },
      create: {
        slug: "skin", name: "مراقبت پوست",
        attributes: { create: [
        { key: "skinType", label: "نوع پوست", options: ["خشک", "چرب", "مختلط", "حساس", "معمولی"] },
        { key: "form", label: "فرم محصول", options: ["کرم", "ژل", "سرم", "لوسیون", "قرص", "کپسول", "اسپری", "بسته"] },
        { key: "spf", label: "SPF", options: ["۳۰", "۵۰", "۵۰+"] },
        { key: "size", label: "حجم / اندازه", options: ["زیر ۵۰", "۵۰ تا ۲۰۰", "بالای ۲۰۰"] },
        { key: "feature", label: "ویژگی درج‌شده", options: ["بدون عطر", "بدون الکل", "وگان", "مناسب پوست حساس", "غیرکومدون‌زا"] }
        ] },
      },
      update: { name: "مراقبت پوست" },
    });
    categories["skin"] = cat.id;
  }
  {
    const cat = await prisma.category.upsert({
      where: { slug: "hair" },
      create: {
        slug: "hair", name: "مراقبت مو",
        attributes: { create: [
        { key: "hairType", label: "نوع مو", options: ["خشک", "چرب", "رنگ‌شده", "آسیب‌دیده", "معمولی"] },
        { key: "scalp", label: "پوست سر", options: ["حساس", "شوره‌دار", "معمولی"] },
        { key: "form", label: "فرم محصول", options: ["کرم", "ژل", "سرم", "لوسیون", "قرص", "کپسول", "اسپری", "بسته"] },
        { key: "size", label: "حجم / اندازه", options: ["زیر ۵۰", "۵۰ تا ۲۰۰", "بالای ۲۰۰"] }
        ] },
      },
      update: { name: "مراقبت مو" },
    });
    categories["hair"] = cat.id;
  }
  {
    const cat = await prisma.category.upsert({
      where: { slug: "supp" },
      create: {
        slug: "supp", name: "ویتامین و مکمل",
        attributes: { create: [
        { key: "form", label: "فرم محصول", options: ["کرم", "ژل", "سرم", "لوسیون", "قرص", "کپسول", "اسپری", "بسته"] },
        { key: "pack", label: "تعداد بسته", options: ["۳۰ عددی", "۶۰ عددی", "۹۰ عددی"] },
        { key: "feature", label: "ویژگی درج‌شده", options: ["بدون عطر", "بدون الکل", "وگان", "مناسب پوست حساس", "غیرکومدون‌زا"] }
        ] },
      },
      update: { name: "ویتامین و مکمل" },
    });
    categories["supp"] = cat.id;
  }
  {
    const cat = await prisma.category.upsert({
      where: { slug: "hygiene" },
      create: {
        slug: "hygiene", name: "بهداشت شخصی",
        attributes: { create: [
        { key: "form", label: "فرم محصول", options: ["کرم", "ژل", "سرم", "لوسیون", "قرص", "کپسول", "اسپری", "بسته"] },
        { key: "size", label: "حجم / اندازه", options: ["زیر ۵۰", "۵۰ تا ۲۰۰", "بالای ۲۰۰"] }
        ] },
      },
      update: { name: "بهداشت شخصی" },
    });
    categories["hygiene"] = cat.id;
  }
  {
    const cat = await prisma.category.upsert({
      where: { slug: "baby" },
      create: {
        slug: "baby", name: "مادر و کودک",
        attributes: { create: [
        { key: "age", label: "ردهٔ سنی", options: ["نوزاد", "۶ ماه به بالا", "۲ سال به بالا", "مادر"] },
        { key: "form", label: "فرم محصول", options: ["کرم", "ژل", "سرم", "لوسیون", "قرص", "کپسول", "اسپری", "بسته"] },
        { key: "size", label: "حجم / اندازه", options: ["زیر ۵۰", "۵۰ تا ۲۰۰", "بالای ۲۰۰"] }
        ] },
      },
      update: { name: "مادر و کودک" },
    });
    categories["baby"] = cat.id;
  }
  {
    const cat = await prisma.category.upsert({
      where: { slug: "device" },
      create: {
        slug: "device", name: "تجهیزات پزشکی",
        attributes: { create: [
        { key: "deviceType", label: "نوع دستگاه", options: ["فشارسنج", "تب‌سنج", "گلوکومتر"] },
        { key: "warranty", label: "گارانتی", options: ["۱ ساله", "۲ ساله"] }
        ] },
      },
      update: { name: "تجهیزات پزشکی" },
    });
    categories["device"] = cat.id;
  }
  {
    const cat = await prisma.category.upsert({
      where: { slug: "daily" },
      create: {
        slug: "daily", name: "سلامت روزمره",
        attributes: { create: [
        { key: "form", label: "فرم محصول", options: ["کرم", "ژل", "سرم", "لوسیون", "قرص", "کپسول", "اسپری", "بسته"] }
        ] },
      },
      update: { name: "سلامت روزمره" },
    });
    categories["daily"] = cat.id;
  }
  {
    const cat = await prisma.category.upsert({
      where: { slug: "sleep" },
      create: {
        slug: "sleep", name: "آرامش و خواب",
        attributes: { create: [
        { key: "form", label: "فرم محصول", options: ["کرم", "ژل", "سرم", "لوسیون", "قرص", "کپسول", "اسپری", "بسته"] }
        ] },
      },
      update: { name: "آرامش و خواب" },
    });
    categories["sleep"] = cat.id;
  }

  
  // ── روش‌های ارسال (بدون این‌ها هیچ سفارشی ثبت نمی‌شود: checkout/place روش ارسال را از دیتابیس می‌خواند) ──
  const SHIPPING = [{"name": "پست پیشتاز", "etaDays": "۳ تا ۵ روز کاری", "fee": 65000, "freeAbove": 800000}, {"name": "ارسال سریع", "etaDays": "۱ تا ۲ روز کاری", "fee": 145000, "freeAbove": 800000}, {"name": "دریافت حضوری", "etaDays": "همان روز، شعبهٔ مرکزی", "fee": 0, "freeAbove": null}];
  if (!(await prisma.shippingZone.findFirst())) {   // فقط اگر هنوز هیچ منطقهٔ ارسالی نیست؛ هزینه‌ها «نمونه»اند و از پنل مدیریت ویرایش می‌شوند
    await prisma.shippingZone.create({ data: { name: "سراسر کشور", provinces: [], methods: { create: SHIPPING } } });
  }

  

  // ── مدیر ارشد: فقط با ADMIN_PHONE (کد ورود به همین شماره پیامک می‌شود) ──
  if (process.env.ADMIN_PHONE) {
    const role = await prisma.role.findUnique({ where: { key: "super" } });
    if (role) await prisma.user.upsert({ where: { phone: process.env.ADMIN_PHONE }, create: { phone: process.env.ADMIN_PHONE, name: ROLE_NAMES.super, roleId: role.id }, update: { roleId: role.id } });
  } else if (process.env.NODE_ENV === "production") {
    console.warn("⚠️  ADMIN_PHONE تنظیم نشده؛ هیچ حساب مدیریتی ساخته نشد و وارد پنل نمی‌توانید شد.");
  }
  return { categories };
}
