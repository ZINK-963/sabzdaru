#!/usr/bin/env node
/* فرانت‌اند (../frontend) را در public/ کپی می‌کند تا Next.js همان را روی همان دامنه‌ای که API هست سرو کند
   (هم‌مبدأ بودن یعنی کوکی نشست بدون CORS کار می‌کند). به‌صورت خودکار قبل از `npm run build` اجرا می‌شود. */
const fs = require("fs"), path = require("path");
const src = path.resolve(__dirname, "..", "..", "frontend"), dst = path.resolve(__dirname, "..", "public");
if (!fs.existsSync(path.join(src, "index.html"))) { console.error("فرانت‌اند پیدا نشد:", src); process.exit(1); }
fs.rmSync(dst, { recursive: true, force: true });
fs.mkdirSync(dst, { recursive: true });
for (const item of ["index.html", "css", "js"]) fs.cpSync(path.join(src, item), path.join(dst, item), { recursive: true });
console.log("frontend → public/ ✓");
