import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canManageTeams, visibleTeamWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assertActiveTeamNameAvailable } from "@/lib/team-service";

const schema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional().nullable()
});

async function getTeam(id: string) {
  return prisma.team.findFirst({
    where: { id, archivedAt: null },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" }
      },
      resources: {
        where: { archivedAt: null },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" }
      },
      _count: { select: { members: true, resources: true } }
    }
  });
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const team = await getTeam(params.id);
    if (!team) return jsonError("Team not found", 404);
    const visible = await prisma.team.findFirst({ where: { id: params.id, ...visibleTeamWhere(user) }, select: { id: true } });
    if (!visible) return jsonError("Forbidden", 403);

    const auditLogs = user.role === "ADMIN"
      ? await prisma.auditLog.findMany({
          where: {
            OR: [
              { details: { path: ["teamId"], equals: params.id } },
              { details: { path: ["teamName"], equals: team.name } }
            ]
          },
          include: { user: true },
          orderBy: { createdAt: "desc" },
          take: 50
        })
      : [];

    return NextResponse.json({ team, auditLogs });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canManageTeams(user)) return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const existing = await prisma.team.findFirst({ where: { id: params.id, archivedAt: null } });
    if (!existing) return jsonError("Team not found", 404);
    const name = await assertActiveTeamNameAvailable(body.name, params.id);
    const team = await prisma.team.update({
      where: { id: params.id },
      data: { name, description: body.description || null }
    });
    await createAuditLog({
      userId: user.id,
      action: "TEAM_UPDATED",
      details: {
        teamId: team.id,
        oldName: existing.name,
        newName: team.name,
        oldDescription: existing.description,
        newDescription: team.description
      }
    });
    return NextResponse.json({ team });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!canManageTeams(user)) return jsonError("Forbidden", 403);
    const existing = await prisma.team.findFirst({
      where: { id: params.id, archivedAt: null },
      include: { _count: { select: { resources: true } } }
    });
    if (!existing) return jsonError("Team not found", 404);
    const team = await prisma.team.update({
      where: { id: params.id },
      data: { archivedAt: new Date() }
    });
    await createAuditLog({
      userId: user.id,
      action: "TEAM_ARCHIVED",
      details: { teamId: team.id, teamName: team.name, resourceCount: existing._count.resources }
    });
    return NextResponse.json({
      team,
      warning: existing._count.resources > 0 ? "This team owns resources, so it has been archived instead of deleted." : null
    });
  } catch (error) {
    return routeError(error);
  }
}
