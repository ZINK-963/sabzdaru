import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

type AuditInput = {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ip?: string | null;
};

/**
 * هر مسیر مدیریتی که چیزی می‌نویسد باید این تابع را صدا بزند — بدون استثنا.
 * ثبت لاگ هرگز نباید نوشتن اصلی را متوقف کند؛ خطای لاگ فقط لاگ می‌شود.
 */
export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({ data: input });
  } catch (err) {
    console.error("audit log write failed", err);
  }
}
