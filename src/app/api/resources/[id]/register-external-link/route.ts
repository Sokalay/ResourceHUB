import { NextResponse } from "next/server";
import { SourceKind, SourceProvider, TransferStatus } from "@prisma/client";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canManageResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  sourceType: z.enum(["EXTERNAL_LINK", "GOOGLE_DRIVE_LINK", "GITHUB_LINK", "HUGGINGFACE_LINK", "SERVER_PATH", "MANUAL"]),
  sourceLocation: z.string().min(1),
  sourceProvider: z.enum(["GOOGLE_DRIVE", "GITHUB", "HUGGINGFACE", "SERVER_PATH", "MANUAL", "OTHER"]).optional(),
  sourceKind: z.enum(["FILE", "FOLDER", "REPOSITORY", "MODEL_REPOSITORY", "DATASET_REPOSITORY", "SPACE_REPOSITORY", "NOTEBOOK", "ARCHIVE", "DATABASE_DUMP", "API_ENDPOINT", "OTHER"]).optional()
});

function inferProvider(sourceType: string) {
  if (sourceType === "GOOGLE_DRIVE_LINK") return SourceProvider.GOOGLE_DRIVE;
  if (sourceType === "GITHUB_LINK") return SourceProvider.GITHUB;
  if (sourceType === "HUGGINGFACE_LINK") return SourceProvider.HUGGINGFACE;
  if (sourceType === "SERVER_PATH") return SourceProvider.SERVER_PATH;
  return SourceProvider.MANUAL;
}

function inferKind(provider: SourceProvider) {
  if (provider === SourceProvider.GITHUB) return SourceKind.REPOSITORY;
  if (provider === SourceProvider.GOOGLE_DRIVE || provider === SourceProvider.SERVER_PATH) return SourceKind.FILE;
  if (provider === SourceProvider.HUGGINGFACE) return SourceKind.DATASET_REPOSITORY;
  return SourceKind.OTHER;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    if (!canManageResource(user, resource)) return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const provider = body.sourceProvider ?? inferProvider(body.sourceType);
    const kind = body.sourceKind ?? inferKind(provider);
    const job = await prisma.$transaction(async (tx) => {
      const created = await tx.transferJob.create({
        data: {
          resourceId: params.id,
          sourceType: body.sourceType,
          sourceLocation: body.sourceLocation,
          status: TransferStatus.PENDING,
          createdById: user.id
        }
      });
      await tx.resource.update({
        where: { id: params.id },
        data: {
          sourceProvider: provider,
          sourceKind: kind,
          sourceUrl: body.sourceLocation,
          currentWorkingLocation: body.sourceLocation
        }
      });
      return created;
    });
    await createAuditLog({
      userId: user.id,
      resourceId: params.id,
      action: "EXTERNAL_LINK_REGISTERED",
      details: body
    });
    await createAuditLog({
      userId: user.id,
      resourceId: params.id,
      action: "TRANSFER_JOB_CREATED",
      details: { transferJobId: job.id, status: job.status }
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
