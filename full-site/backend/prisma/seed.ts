import { PrismaClient } from "@prisma/client";
import { seedBase } from "./seed-base";
import { seedDemo } from "./seed-demo";

const prisma = new PrismaClient();

/**
 * npm run seed        → فقط داده‌های پایهٔ سیستم (امن برای production؛ تکرارپذیر؛ چیزی حذف نمی‌کند)
 * npm run seed:demo   → پایه + داده‌های نمایشی (برای توسعه/دمو؛ در production رد می‌شود)
 */
export async function main() {
  const { categories } = await seedBase(prisma);
  console.log("base seed complete:", Object.keys(categories).length, "categories");
  if (process.env.SEED_DEMO === "1") await seedDemo(prisma, categories);
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
