import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { fmt } from "@/lib/shape";
import { ROLE_NAMES } from "@/lib/roles";
import { handle, json, parse, requirePermission } from "@/lib/http";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1), perPage: z.coerce.number().int().min(1).max(100).default(50),
  entity: z.string().optional(), action: z.string().optional(),
});
const short = (v: unknown) => (v == null ? "—" : JSON.stringify(v));

// خواندن مجاز است؛ نوشتن روی این جدول هرگز از طریق API عمومی انجام نمی‌شود —
// فقط lib/audit.ts داخلی آن را پر می‌کند. اینجا endpoint نوشتن عمداً وجود ندارد.
export const GET = handle(async (req: NextRequest) => {
  await requirePermission("audit.read");
  const q = parse<z.infer<typeof querySchema>>(querySchema, Object.fromEntries(new URL(req.url).searchParams));
  const where: any = {};
  if (q.entity) where.entity = q.entity;
  if (q.action) where.action = q.action;
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.perPage, take: q.perPage }),
  ]);
  return json({
    logs: rows.map((a: any) => ({ id: a.id, who: a.actorRole ? ROLE_NAMES[a.actorRole] ?? a.actorRole : "سیستم", action: a.action, entity: `${a.entity} ${a.entityId}`, before: short(a.before), after: short(a.after), at: fmt(a.createdAt) })),
    page: q.page, perPage: q.perPage, total, totalPages: Math.max(1, Math.ceil(total / q.perPage)),
  });
});
