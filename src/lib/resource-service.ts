import { ApprovalType, Prisma, ResourceStatus, SourceKind, SourceProvider, SourceType, StorageProvider, TransferStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import {
  calculateSha256,
  deleteFile,
  generateResourceSlug,
  generateStoragePath,
  getFileMetadata,
  saveUploadedFile,
  validateFileName
} from "@/lib/storage";
import { normalizeTags } from "@/lib/resource-metadata";

export async function createUniqueSlug(name: string) {
  const base = generateResourceSlug(name);
  let slug = base;
  let suffix = 2;
  while (await prisma.resource.findUnique({ where: { slug } })) {
    slug = `${base}_${suffix}`;
    suffix += 1;
  }
  return slug;
}

export async function nextVersionNumber(resourceId: string, tx: Prisma.TransactionClient = prisma) {
  const latest = await tx.resourceVersion.findFirst({
    where: { resourceId },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true }
  });
  return (latest?.versionNumber ?? 0) + 1;
}

export async function createResourceWithOptionalLink(input: {
  name: string;
  description?: string | null;
  resourceType: Prisma.ResourceCreateInput["resourceType"];
  classification: Prisma.ResourceCreateInput["classification"];
  primaryCategoryId?: string | null;
  projectId?: string | null;
  contributedByTeamId?: string | null;
  ownerUserId: string;
  teamId: string;
  currentWorkingLocation?: string | null;
  sourceProvider?: SourceProvider;
  sourceKind?: SourceKind;
  sourceUrl?: string | null;
  storageProvider?: StorageProvider;
  sourceAccessGranted?: boolean;
  metadataJson?: Prisma.InputJsonValue;
  tags?: string[] | string | null;
  sourceType?: SourceType;
  sourceLocation?: string | null;
  createdById: string;
}) {
  const slug = await createUniqueSlug(input.name);
  return prisma.$transaction(async (tx) => {
    const resource = await tx.resource.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        resourceType: input.resourceType,
        classification: input.classification,
        primaryCategoryId: input.primaryCategoryId || null,
        projectId: input.projectId || null,
        contributedByTeamId: input.contributedByTeamId || null,
        ownerUserId: input.ownerUserId,
        teamId: input.teamId,
        currentWorkingLocation: input.currentWorkingLocation,
        sourceAccessGranted: input.sourceAccessGranted ?? false,
        sourceProvider: input.sourceProvider ?? SourceProvider.MANUAL,
        sourceKind: input.sourceKind ?? SourceKind.OTHER,
        sourceUrl: input.sourceUrl || input.sourceLocation || null,
        storageProvider: input.storageProvider ?? StorageProvider.LOCAL,
        metadataJson: input.metadataJson,
        status: ResourceStatus.SUBMITTED,
        createdById: input.createdById,
        tags: { create: normalizeTags(input.tags).map((name) => ({ name })) }
      }
    });

    await tx.auditLog.create({
      data: {
        userId: input.createdById,
        resourceId: resource.id,
        action: "RESOURCE_CREATED",
        details: { name: resource.name, slug: resource.slug, categoryId: resource.primaryCategoryId, sourceProvider: resource.sourceProvider }
      }
    });

    if (input.sourceLocation) {
      await tx.transferJob.create({
        data: {
          resourceId: resource.id,
          sourceType: input.sourceType ?? SourceType.EXTERNAL_LINK,
          sourceLocation: input.sourceLocation,
          status: TransferStatus.PENDING,
          createdById: input.createdById
        }
      });
      await tx.auditLog.create({
        data: {
          userId: input.createdById,
          resourceId: resource.id,
          action: "EXTERNAL_LINK_REGISTERED",
          details: { sourceLocation: input.sourceLocation, sourceType: input.sourceType ?? SourceType.EXTERNAL_LINK }
        }
      });
    }

    return resource;
  });
}

export async function uploadResourceFile(input: {
  resourceId: string;
  file: File;
  versionName?: string | null;
  versionDescription?: string | null;
  userId: string;
  autoApprove?: boolean;
}) {
  if (!validateFileName(input.file.name)) {
    throw new Error("INVALID_FILE_TYPE");
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 104857600);
  if (input.file.size > maxBytes) {
    throw new Error("FILE_TOO_LARGE");
  }

  const resource = await prisma.resource.findUniqueOrThrow({ where: { id: input.resourceId } });
  const versionNumber = await nextVersionNumber(input.resourceId);
  const storagePath = generateStoragePath(resource.resourceType, resource.slug, versionNumber, input.file.name);
  let absolutePath: string | null = null;

  try {
    absolutePath = await saveUploadedFile(input.file, storagePath);
    const [checksum, metadata] = await Promise.all([calculateSha256(absolutePath), getFileMetadata(absolutePath)]);

    return await prisma.$transaction(async (tx) => {
      const version = await tx.resourceVersion.create({
        data: {
          resourceId: input.resourceId,
          versionNumber,
          versionName: input.versionName || `v${versionNumber}`,
          description: input.versionDescription,
          storagePath,
          checksum,
          fileCount: 1,
          totalSizeBytes: metadata.size,
          createdById: input.userId
        }
      });

      const transferJob = await tx.transferJob.create({
        data: {
          resourceId: input.resourceId,
          versionId: version.id,
          sourceType: SourceType.UPLOAD,
          sourceLocation: input.file.name,
          destinationLocation: storagePath,
          status: input.autoApprove ? TransferStatus.COMPLETED : TransferStatus.PENDING,
          startedAt: input.autoApprove ? new Date() : null,
          completedAt: input.autoApprove ? new Date() : null,
          createdById: input.userId
        }
      });

      const resourceFile = await tx.resourceFile.create({
        data: {
          resourceId: input.resourceId,
          versionId: version.id,
          originalFileName: input.file.name,
          storedFileName: storagePath.split("/").pop() ?? input.file.name,
          fileType: metadata.extension,
          mimeType: input.file.type || null,
          fileSizeBytes: metadata.size,
          checksumSha256: checksum,
          storagePath,
          uploadedById: input.userId
        }
      });

      await tx.resource.update({
        where: { id: input.resourceId },
        data: {
          status: input.autoApprove ? ResourceStatus.STORED : ResourceStatus.SUBMITTED,
          officialStorageLocation: input.autoApprove ? storagePath : undefined,
          stagingStorageLocation: storagePath,
          sourceProvider: SourceProvider.DIRECT_UPLOAD,
          sourceKind: ["zip", "7z", "tar", "gz"].includes(metadata.extension) ? SourceKind.ARCHIVE : SourceKind.FILE,
          storageProvider: StorageProvider.LOCAL,
          teamApprovedAt: input.autoApprove ? new Date() : undefined,
          teamApprovedById: input.autoApprove ? input.userId : undefined
        }
      });

      if (!input.autoApprove) {
        await tx.approvalRequest.create({
          data: {
            resourceId: input.resourceId,
            requestedById: input.userId,
            type: ApprovalType.RESOURCE_STORAGE,
            note: `Approve upload ${input.file.name} as the official Resource Hub copy.`
          }
        });
      }

      await tx.auditLog.createMany({
        data: [
          { userId: input.userId, resourceId: input.resourceId, action: "VERSION_CREATED", details: { versionNumber } },
          { userId: input.userId, resourceId: input.resourceId, action: "FILE_UPLOADED", details: { fileName: input.file.name, storagePath } },
          { userId: input.userId, resourceId: input.resourceId, action: "TRANSFER_JOB_CREATED", details: { transferJobId: transferJob.id } },
          input.autoApprove
            ? { userId: input.userId, resourceId: input.resourceId, action: "TRANSFER_COMPLETED", details: { transferJobId: transferJob.id } }
            : { userId: input.userId, resourceId: input.resourceId, action: "RESOURCE_STORAGE_APPROVAL_REQUESTED", details: { transferJobId: transferJob.id } }
        ]
      });

      return { version, transferJob, resourceFile };
    });
  } catch (error) {
    if (absolutePath) {
      await deleteFile(storagePath).catch(() => undefined);
    }
    await prisma.resource.update({
      where: { id: input.resourceId },
      data: { status: ResourceStatus.FAILED }
    }).catch(() => undefined);
    await createAuditLog({
      userId: input.userId,
      resourceId: input.resourceId,
      action: "TRANSFER_FAILED",
      details: { error: error instanceof Error ? error.message : "Upload failed" }
    }).catch(() => undefined);
    throw error;
  }
}
