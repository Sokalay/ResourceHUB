import { ApprovalType, ResourceVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { applyResourceVisibility } from "@/lib/approval-service";
import { jsonError, routeError } from "@/lib/http";
import { canChangeResourceVisibility, canRequestPublicVisibility } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  visibility: z.enum(["TEAM_ONLY", "ORGANIZATION", "VISITOR", "PUBLIC"])
});

function approvalTypeForVisibility(visibility: ResourceVisibility) {
  return visibility === ResourceVisibility.PUBLIC ? ApprovalType.VISIBILITY_PUBLIC : ApprovalType.VISIBILITY_VISITOR;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    const { visibility } = schema.parse(await request.json());
    const target = visibility as ResourceVisibility;

    if (canChangeResourceVisibility(user, resource, target)) {
      const updated = await applyResourceVisibility({ resourceId: params.id, visibility: target, reviewedById: user.id });
      await createAuditLog({
        userId: user.id,
        resourceId: params.id,
        action: "RESOURCE_VISIBILITY_CHANGED",
        details: { oldVisibility: resource.visibility, newVisibility: target }
      });
      return NextResponse.json({ resource: updated });
    }

    if (!canRequestPublicVisibility(user, resource, target)) return jsonError("Forbidden", 403);

    const requestRecord = await prisma.$transaction(async (tx) => {
      await tx.approvalRequest.updateMany({
        where: {
          resourceId: params.id,
          type: { in: [ApprovalType.VISIBILITY_PUBLIC, ApprovalType.VISIBILITY_VISITOR] },
          status: "PENDING"
        },
        data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), decisionNote: "Superseded by a newer visibility request." }
      });
      const approvalRequest = await tx.approvalRequest.create({
        data: {
          resourceId: params.id,
          requestedById: user.id,
          type: approvalTypeForVisibility(target),
          requestedVisibility: target,
          note: `Request approval to make this resource ${target}.`
        }
      });
      await tx.resource.update({ where: { id: params.id }, data: { pendingVisibility: target } });
      return approvalRequest;
    });

    await createAuditLog({
      userId: user.id,
      resourceId: params.id,
      action: "RESOURCE_VISIBILITY_APPROVAL_REQUESTED",
      details: { oldVisibility: resource.visibility, requestedVisibility: target, approvalRequestId: requestRecord.id }
    });
    return NextResponse.json({ approvalRequest: requestRecord }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
