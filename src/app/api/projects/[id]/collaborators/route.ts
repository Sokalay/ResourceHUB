import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canManageProjects } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(["CONTRIBUTOR", "REVIEWER", "VIEWER"]).default("CONTRIBUTOR")
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canManageProjects(user)) return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const project = await prisma.project.findUnique({ where: { id: params.id } });
    if (!project || project.archivedAt) return jsonError("Project not found", 404);
    await prisma.user.findUniqueOrThrow({ where: { id: body.userId } });
    const collaborator = await prisma.projectCollaborator.upsert({
      where: { projectId_userId: { projectId: params.id, userId: body.userId } },
      update: { role: body.role },
      create: { projectId: params.id, userId: body.userId, role: body.role }
    });
    await createAuditLog({ userId: user.id, action: "PROJECT_COLLABORATOR_ADDED", details: { projectId: params.id, collaboratorUserId: body.userId, role: body.role } });
    return NextResponse.json({ collaborator });
  } catch (error) {
    return routeError(error);
  }
}
