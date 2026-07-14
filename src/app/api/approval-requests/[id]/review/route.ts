import { ApprovalStatus, ApprovalType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { applyResourceVisibility, approveResourceStorage } from "@/lib/approval-service";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional().nullable()
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const { decision, note } = schema.parse(await request.json());
    const approvalRequest = await prisma.approvalRequest.findUniqueOrThrow({
      where: { id: params.id },
      include: { resource: true }
    });
    if (approvalRequest.status !== ApprovalStatus.PENDING) return jsonError("Approval request already reviewed", 409);

    const reviewed = await prisma.$transaction(async (tx) => {
      if (decision === ApprovalStatus.APPROVED && approvalRequest.type === ApprovalType.RESOURCE_STORAGE) {
        await approveResourceStorage({ resourceId: approvalRequest.resourceId, reviewedById: user.id, decisionNote: note, tx });
      } else if (decision === ApprovalStatus.APPROVED && approvalRequest.requestedVisibility) {
        await applyResourceVisibility({
          resourceId: approvalRequest.resourceId,
          visibility: approvalRequest.requestedVisibility,
          reviewedById: user.id,
          tx
        });
      } else if (approvalRequest.requestedVisibility) {
        await tx.resource.update({ where: { id: approvalRequest.resourceId }, data: { pendingVisibility: null } });
      }

      return tx.approvalRequest.update({
        where: { id: params.id },
        data: {
          status: decision as ApprovalStatus,
          reviewedById: user.id,
          decisionNote: note ?? null,
          reviewedAt: new Date()
        }
      });
    });

    await createAuditLog({
      userId: user.id,
      resourceId: approvalRequest.resourceId,
      action: decision === ApprovalStatus.APPROVED ? "APPROVAL_REQUEST_APPROVED" : "APPROVAL_REQUEST_REJECTED",
      details: { approvalRequestId: params.id, type: approvalRequest.type, requestedVisibility: approvalRequest.requestedVisibility }
    });

    if (decision === ApprovalStatus.APPROVED && approvalRequest.requestedVisibility) {
      await createAuditLog({
        userId: user.id,
        resourceId: approvalRequest.resourceId,
        action: "RESOURCE_VISIBILITY_CHANGED",
        details: { oldVisibility: approvalRequest.resource.visibility, newVisibility: approvalRequest.requestedVisibility }
      });
    }

    return NextResponse.json({ approvalRequest: reviewed });
  } catch (error) {
    return routeError(error);
  }
}
