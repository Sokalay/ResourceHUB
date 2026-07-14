import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertCanRemoveMember } from "@/lib/team-service";

const schema = z.object({
  role: z.enum(["OWNER", "MEMBER"])
});

export async function PATCH(request: Request, { params }: { params: { id: string; memberId: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const team = await prisma.team.findFirst({ where: { id: params.id, archivedAt: null } });
    if (!team) return jsonError("Team not found", 404);
    const existing = await prisma.teamMember.findFirst({
      where: { id: params.memberId, teamId: params.id },
      include: { user: true }
    });
    if (!existing) return jsonError("Team member not found.", 404);
    const member = await prisma.teamMember.update({
      where: { id: params.memberId },
      data: { role: body.role },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });
    await createAuditLog({
      userId: user.id,
      action: "TEAM_MEMBER_ROLE_UPDATED",
      details: {
        teamId: params.id,
        teamName: team.name,
        userId: existing.userId,
        oldRole: existing.role,
        newRole: body.role
      }
    });
    return NextResponse.json({ member });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string; memberId: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const team = await prisma.team.findFirst({ where: { id: params.id, archivedAt: null } });
    if (!team) return jsonError("Team not found", 404);
    const target = await assertCanRemoveMember(params.id, params.memberId);
    await prisma.teamMember.delete({ where: { id: params.memberId } });
    await createAuditLog({
      userId: user.id,
      action: "TEAM_MEMBER_REMOVED",
      details: { teamId: params.id, teamName: team.name, userId: target.userId, role: target.role }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
