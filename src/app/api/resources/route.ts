import { NextResponse } from "next/server";
import { ProjectCollaboratorRole } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canContributeToProject, canCreateResource } from "@/lib/permissions";
import { getResourceList } from "@/lib/resource-query";
import { createResourceWithOptionalLink } from "@/lib/resource-service";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().optional(),
  resourceType: z.enum(["DATASET", "CODE", "MODEL", "DOCUMENT", "ANNOTATION", "NOTEBOOK", "REPORT", "APPLICATION", "OTHER"]),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]),
  primaryCategoryId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  ownerUserId: z.string().min(1),
  teamId: z.string().min(1),
  currentWorkingLocation: z.string().optional(),
  sourceProvider: z.enum(["DIRECT_UPLOAD", "GOOGLE_DRIVE", "GITHUB", "HUGGINGFACE", "SERVER_PATH", "S3", "GCS", "MINIO", "MANUAL", "OTHER"]).optional(),
  sourceKind: z.enum(["FILE", "FOLDER", "REPOSITORY", "MODEL_REPOSITORY", "DATASET_REPOSITORY", "SPACE_REPOSITORY", "NOTEBOOK", "ARCHIVE", "DATABASE_DUMP", "API_ENDPOINT", "OTHER"]).optional(),
  sourceUrl: z.string().optional().nullable(),
  storageProvider: z.enum(["LOCAL", "MINIO", "S3", "GCS", "GOOGLE_DRIVE", "GITHUB", "HUGGINGFACE", "INTERNAL_SERVER", "OTHER"]).optional(),
  sourceAccessGranted: z.boolean().optional(),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  hasUpload: z.boolean().optional(),
  sourceType: z.enum(["UPLOAD", "EXTERNAL_LINK", "GOOGLE_DRIVE_LINK", "GITHUB_LINK", "HUGGINGFACE_LINK", "SERVER_PATH", "MANUAL"]).optional(),
  sourceLocation: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const result = await getResourceList(searchParams, user);
    return NextResponse.json({ resources: result.data, ...result });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canCreateResource(user)) return jsonError("Forbidden", 403);
    const body = createSchema.parse(await request.json());
    if (!body.hasUpload && !body.currentWorkingLocation && !body.sourceLocation && !body.sourceUrl) {
      return jsonError("Current working location or source location is required when no file is uploaded");
    }
    const userTeamIds = user.teamMembers.map((member) => member.teamId);
    let teamId = body.teamId;
    let contributedByTeamId: string | null = null;
    if (body.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: body.projectId },
        include: { collaborators: true }
      });
      if (!project || project.archivedAt) return jsonError("Project not found", 404);
      if (!canContributeToProject(user, project)) return jsonError("You can only submit to projects where you are a contributor", 403);
      teamId = project.teamId;
      contributedByTeamId = userTeamIds.find((id) => id !== project.teamId) ?? null;
      if (user.role !== "ADMIN" && !userTeamIds.includes(project.teamId)) {
        const collaborator = project.collaborators.find((entry) => entry.userId === user.id);
        if (collaborator?.role !== ProjectCollaboratorRole.CONTRIBUTOR) return jsonError("Project collaborator contributor access is required", 403);
      }
    } else if (user.role !== "ADMIN" && !userTeamIds.includes(body.teamId)) {
      return jsonError("You can only submit resources for your team", 403);
    }
    const resource = await createResourceWithOptionalLink({
      ...body,
      ownerUserId: user.role === "ADMIN" ? body.ownerUserId : user.id,
      teamId,
      projectId: body.projectId || null,
      contributedByTeamId,
      createdById: user.id
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
