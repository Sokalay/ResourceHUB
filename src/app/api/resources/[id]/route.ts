import { NextResponse } from "next/server";
import { Prisma, ResourceStatus } from "@prisma/client";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canArchiveResource, canManageResource, canViewResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { normalizeTags } from "@/lib/resource-metadata";

const updateSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  description: z.string().optional().nullable(),
  resourceType: z.enum(["DATASET", "CODE", "MODEL", "DOCUMENT", "ANNOTATION", "NOTEBOOK", "REPORT", "APPLICATION", "OTHER"]).optional(),
  primaryCategoryId: z.string().optional().nullable(),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]).optional(),
  ownerUserId: z.string().optional(),
  teamId: z.string().optional(),
  sourceProvider: z.enum(["DIRECT_UPLOAD", "GOOGLE_DRIVE", "GITHUB", "HUGGINGFACE", "SERVER_PATH", "S3", "GCS", "MINIO", "MANUAL", "OTHER"]).optional(),
  sourceKind: z.enum(["FILE", "FOLDER", "REPOSITORY", "MODEL_REPOSITORY", "DATASET_REPOSITORY", "SPACE_REPOSITORY", "NOTEBOOK", "ARCHIVE", "DATABASE_DUMP", "API_ENDPOINT", "OTHER"]).optional(),
  sourceUrl: z.string().optional().nullable(),
  storageProvider: z.enum(["LOCAL", "MINIO", "S3", "GCS", "GOOGLE_DRIVE", "GITHUB", "HUGGINGFACE", "INTERNAL_SERVER", "OTHER"]).optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  currentWorkingLocation: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "SUBMITTED", "TRANSFERRING", "STORED", "FAILED", "ARCHIVED"]).optional()
});

async function findResource(id: string) {
  return prisma.resource.findUnique({
    where: { id },
    include: {
      owner: true,
      team: true,
      project: { include: { collaborators: true } },
      createdBy: true,
      primaryCategory: { include: { parent: { include: { parent: true } } } },
      tags: true,
      versions: { orderBy: { versionNumber: "desc" }, include: { files: true, createdBy: true } },
      files: { orderBy: { uploadedAt: "desc" }, include: { uploadedBy: true } },
      transferJobs: { orderBy: { createdAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" }, include: { user: true } }
    }
  });
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await findResource(params.id);
    if (!resource) return jsonError("Resource not found", 404);
    if (!canViewResource(user, resource)) return jsonError("Forbidden", 403);
    await createAuditLog({ userId: user.id, resourceId: resource.id, action: "RESOURCE_VIEWED" });
    return NextResponse.json({ resource });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id }, include: { tags: true } });
    if (!canManageResource(user, resource)) return jsonError("Forbidden", 403);
    const parsed = updateSchema.parse(await request.json());
    const { tags, ...body } = parsed;
    if (body.status && user.role !== "ADMIN") delete body.status;
    const updateData: Prisma.ResourceUncheckedUpdateInput = {
      ...body,
      primaryCategoryId: body.primaryCategoryId === undefined ? undefined : body.primaryCategoryId
    };
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.resource.update({ where: { id: params.id }, data: updateData });
      if (tags !== undefined) {
        await tx.resourceTag.deleteMany({ where: { resourceId: params.id } });
        const normalized = normalizeTags(tags);
        if (normalized.length) {
          await tx.resourceTag.createMany({ data: normalized.map((name) => ({ resourceId: params.id, name })), skipDuplicates: true });
        }
      }
      return next;
    });

    const logs: Array<{ action: string; details?: Prisma.InputJsonValue }> = [{ action: "RESOURCE_UPDATED", details: updateData as Prisma.InputJsonObject }];
    if (body.primaryCategoryId !== undefined && body.primaryCategoryId !== resource.primaryCategoryId) logs.push({ action: "RESOURCE_CATEGORY_CHANGED", details: { oldCategoryId: resource.primaryCategoryId, newCategoryId: body.primaryCategoryId } });
    if (body.classification && body.classification !== resource.classification) logs.push({ action: "RESOURCE_CLASSIFICATION_CHANGED", details: { oldClassification: resource.classification, newClassification: body.classification } });
    if (body.teamId && body.teamId !== resource.teamId) logs.push({ action: "RESOURCE_TEAM_CHANGED", details: { oldTeamId: resource.teamId, newTeamId: body.teamId } });
    if (body.ownerUserId && body.ownerUserId !== resource.ownerUserId) logs.push({ action: "RESOURCE_OWNER_CHANGED", details: { oldOwnerUserId: resource.ownerUserId, newOwnerUserId: body.ownerUserId } });
    if (body.status && body.status !== resource.status) logs.push({ action: "RESOURCE_STATUS_CHANGED", details: { oldStatus: resource.status, newStatus: body.status } });
    if (body.sourceProvider || body.sourceKind || body.sourceUrl !== undefined) logs.push({ action: "RESOURCE_SOURCE_METADATA_UPDATED", details: { sourceProvider: body.sourceProvider, sourceKind: body.sourceKind, sourceUrl: body.sourceUrl } });
    if (tags !== undefined) logs.push({ action: "RESOURCE_TAGS_UPDATED", details: { oldTags: resource.tags.map((tag) => tag.name), newTags: normalizeTags(tags) } });
    await Promise.all(logs.map((log) => createAuditLog({ userId: user.id, resourceId: params.id, action: log.action, details: log.details })));
    return NextResponse.json({ resource: updated });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    if (!canArchiveResource(user)) return jsonError("Forbidden", 403);
    const updated = await prisma.resource.update({
      where: { id: params.id },
      data: { status: ResourceStatus.ARCHIVED, archivedAt: new Date() }
    });
    await createAuditLog({ userId: user.id, resourceId: params.id, action: "RESOURCE_ARCHIVED" });
    return NextResponse.json({ resource: updated });
  } catch (error) {
    return routeError(error);
  }
}
