import { NextResponse } from "next/server";
import { z } from "zod";
import { ResourceStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  resourceIds: z.array(z.string()).min(1),
  action: z.enum(["ARCHIVE", "CHANGE_CLASSIFICATION", "CHANGE_TEAM", "CHANGE_CATEGORY", "CHANGE_STATUS"]),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).optional(),
  teamId: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  status: z.enum(["DRAFT", "SUBMITTED", "TRANSFERRING", "STORED", "FAILED", "ARCHIVED"]).optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const data =
      body.action === "ARCHIVE"
        ? { status: ResourceStatus.ARCHIVED, archivedAt: new Date() }
        : body.action === "CHANGE_CLASSIFICATION"
          ? { classification: body.classification }
          : body.action === "CHANGE_TEAM"
            ? { teamId: body.teamId }
            : body.action === "CHANGE_CATEGORY"
              ? { primaryCategoryId: body.categoryId }
              : { status: body.status };
    const updated = await prisma.resource.updateMany({
      where: { id: { in: body.resourceIds } },
      data
    });
    const auditAction =
      body.action === "ARCHIVE"
        ? "RESOURCE_BULK_ARCHIVED"
        : body.action === "CHANGE_CATEGORY"
          ? "RESOURCE_BULK_CATEGORY_CHANGED"
          : `RESOURCE_${body.action.replace("CHANGE_", "")}_CHANGED`;
    await Promise.all(body.resourceIds.map((resourceId) => createAuditLog({
      userId: user.id,
      resourceId,
      action: auditAction,
      details: { action: body.action, data }
    })));
    return NextResponse.json({ updated: updated.count });
  } catch (error) {
    return routeError(error);
  }
}
