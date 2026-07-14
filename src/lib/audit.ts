import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createAuditLog(input: {
  userId: string;
  resourceId?: string | null;
  action: string;
  details?: Prisma.InputJsonValue;
}) {
  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      resourceId: input.resourceId ?? null,
      action: input.action,
      details: input.details ?? undefined
    }
  });
}
