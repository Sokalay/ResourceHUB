import { ApprovalStatus, ApprovalType, Prisma, ResourceStatus, ResourceVisibility, StorageHandling, TransferStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function requiresAdminVisibilityApproval(visibility: ResourceVisibility) {
  return visibility === ResourceVisibility.PUBLIC || visibility === ResourceVisibility.VISITOR;
}

export async function approveResourceStorage(input: {
  resourceId: string;
  reviewedById: string;
  decisionNote?: string | null;
  sourceAccessInstructions?: string | null;
  storageHandling?: StorageHandling;
  tx?: Prisma.TransactionClient;
}) {
  const client = input.tx ?? prisma;
  const [resource, latestVersion] = await Promise.all([
    client.resource.findUniqueOrThrow({
      where: { id: input.resourceId },
      select: { sourceUrl: true, currentWorkingLocation: true }
    }),
    client.resourceVersion.findFirst({
      where: { resourceId: input.resourceId },
      orderBy: { versionNumber: "desc" },
      select: { id: true, storagePath: true }
    })
  ]);
  const storageHandling = input.storageHandling ?? StorageHandling.STANDARD_LOCAL;
  const reviewLocation = latestVersion?.storagePath ?? resource.sourceUrl ?? resource.currentWorkingLocation ?? null;
  if (!reviewLocation) throw new Error("NO_SOURCE_TO_APPROVE");

  const pendingRequest = await client.approvalRequest.findFirst({
    where: { resourceId: input.resourceId, type: ApprovalType.RESOURCE_STORAGE, status: ApprovalStatus.PENDING },
    orderBy: { createdAt: "desc" }
  });

  if (pendingRequest) {
    await client.approvalRequest.update({
      where: { id: pendingRequest.id },
      data: {
        status: ApprovalStatus.APPROVED,
        reviewedById: input.reviewedById,
        decisionNote: input.decisionNote ?? null,
        reviewedAt: new Date()
      }
    });
  }

  if (latestVersion) {
    await client.transferJob.updateMany({
      where: { resourceId: input.resourceId, versionId: latestVersion.id, status: TransferStatus.PENDING },
      data: { status: TransferStatus.COMPLETED, startedAt: new Date(), completedAt: new Date() }
    });
  }

  return client.resource.update({
    where: { id: input.resourceId },
    data: {
      status: ResourceStatus.STORED,
      officialStorageLocation: storageHandling === StorageHandling.EXTERNAL_REFERENCE_ONLY ? null : reviewLocation,
      stagingStorageLocation: latestVersion?.storagePath ?? undefined,
      storageHandling,
      sourceAccessInstructions: input.sourceAccessInstructions ?? undefined,
      storageDecisionNotes: input.decisionNote ?? undefined,
      teamApprovedAt: new Date(),
      teamApprovedById: input.reviewedById
    }
  });
}

export async function applyResourceVisibility(input: {
  resourceId: string;
  visibility: ResourceVisibility;
  reviewedById: string;
  tx?: Prisma.TransactionClient;
}) {
  const client = input.tx ?? prisma;
  return client.resource.update({
    where: { id: input.resourceId },
    data: {
      visibility: input.visibility,
      pendingVisibility: null,
      adminApprovedAt: requiresAdminVisibilityApproval(input.visibility) ? new Date() : undefined,
      adminApprovedById: requiresAdminVisibilityApproval(input.visibility) ? input.reviewedById : undefined
    }
  });
}
