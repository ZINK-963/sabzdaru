/** npm run seed:demo — پایه + داده‌های نمایشی (در production رد می‌شود) */
process.env.SEED_DEMO = "1";
import("./seed").then(async (m) => { await m.main(); process.exit(0); }).catch((e) => { console.error(e); process.exit(1); });
