/** مسیر ماژول‌های Next/Prisma/Redis(/zod اگر نصب نیست) را به shim های testkit هدایت می‌کند. باید قبل از import هر route اجرا شود. */
import * as path from "path";
const Module = require("module");
const here = __dirname; const shim = (n: string) => path.join(here, "shims", n);
const map: Record<string, string> = { "next/server": shim("next-server.ts"), "next/headers": shim("next-headers.ts"), "ioredis": shim("ioredis.ts"), "@prisma/client": path.join(here, "fake-prisma.ts") };
let haveZod = true; try { require.resolve("zod"); } catch { haveZod = false; }
if (!haveZod) map["zod"] = shim("zod.ts");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request: string, ...rest: any[]) { if (map[request]) return map[request]; return orig.call(this, request, ...rest); };
export const usingRealZod = haveZod;
