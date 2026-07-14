import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { jsonError, routeError } from "@/lib/http";
import { visibleTeamWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { assertActiveTeamNameAvailable } from "@/lib/team-service";

const schema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional().nullable()
});

export async function GET() {
  try {
    const user = await requireUser();
    const teams = await prisma.team.findMany({
      where: visibleTeamWhere(user),
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "asc" } },
        _count: { select: { members: true, resources: true } }
      },
      orderBy: { name: "asc" }
    });
    return NextResponse.json({ teams });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const name = await assertActiveTeamNameAvailable(body.name);
    const team = await prisma.team.create({ data: { name, description: body.description || null } });
    await createAuditLog({
      userId: user.id,
      action: "TEAM_CREATED",
      details: { teamId: team.id, teamName: team.name }
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
