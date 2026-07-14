import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canManageProjects } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: { id: string; collaboratorId: string } }) {
  try {
    const user = await requireUser();
    if (!canManageProjects(user)) return jsonError("Forbidden", 403);
    const collaborator = await prisma.projectCollaborator.findFirst({ where: { id: params.collaboratorId, projectId: params.id } });
    if (!collaborator) return jsonError("Collaborator not found", 404);
    await prisma.projectCollaborator.delete({ where: { id: collaborator.id } });
    await createAuditLog({ userId: user.id, action: "PROJECT_COLLABORATOR_REMOVED", details: { projectId: params.id, collaboratorUserId: collaborator.userId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
