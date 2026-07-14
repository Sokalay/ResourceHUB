import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { approveResourceStorage } from "@/lib/approval-service";
import { jsonError, routeError } from "@/lib/http";
import { canApproveTeamResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  storageHandling: z.enum(["STANDARD_LOCAL", "ORGANIZATION_INTERNAL", "RESTRICTED_LOCAL", "EXTERNAL_REFERENCE_ONLY"]).optional(),
  sourceAccessInstructions: z.string().optional().nullable(),
  decisionNote: z.string().optional().nullable()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    if (!canApproveTeamResource(user, resource)) return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json().catch(() => ({})));

    const updated = await approveResourceStorage({
      resourceId: params.id,
      reviewedById: user.id,
      storageHandling: body.storageHandling,
      sourceAccessInstructions: body.sourceAccessInstructions,
      decisionNote: body.decisionNote
    });
    await createAuditLog({
      userId: user.id,
      resourceId: params.id,
      action: "RESOURCE_STORAGE_APPROVED",
      details: { storageHandling: body.storageHandling, hasSourceAccessInstructions: Boolean(body.sourceAccessInstructions) }
    });
    await createAuditLog({ userId: user.id, resourceId: params.id, action: "TRANSFER_COMPLETED" });
    return NextResponse.json({ resource: updated });
  } catch (error) {
    return routeError(error);
  }
}
