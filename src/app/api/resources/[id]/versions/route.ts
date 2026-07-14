import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canManageResource, canViewResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { nextVersionNumber } from "@/lib/resource-service";
import { createAuditLog } from "@/lib/audit";

const schema = z.object({
  versionName: z.string().min(1),
  description: z.string().optional()
});

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    if (!canViewResource(user, resource)) return jsonError("Forbidden", 403);
    const versions = await prisma.resourceVersion.findMany({
      where: { resourceId: params.id },
      include: { files: true, createdBy: true },
      orderBy: { versionNumber: "desc" }
    });
    return NextResponse.json({ versions });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    if (!canManageResource(user, resource)) return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const versionNumber = await nextVersionNumber(params.id);
    const version = await prisma.resourceVersion.create({
      data: {
        resourceId: params.id,
        versionNumber,
        versionName: body.versionName,
        description: body.description,
        storagePath: `${resource.resourceType.toLowerCase()}/${resource.slug}/v${versionNumber}`,
        createdById: user.id
      }
    });
    await createAuditLog({ userId: user.id, resourceId: params.id, action: "VERSION_CREATED", details: { versionNumber } });
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
