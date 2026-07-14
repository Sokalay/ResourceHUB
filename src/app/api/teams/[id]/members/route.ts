import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  userId: z.string().min(1).optional(),
  user_id: z.string().min(1).optional(),
  role: z.enum(["OWNER", "MEMBER"]).default("MEMBER")
}).refine((value) => value.userId || value.user_id, { message: "User is required" });

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const userId = body.userId ?? body.user_id ?? "";
    const [targetUser, team, existing] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.team.findFirst({ where: { id: params.id, archivedAt: null } }),
      prisma.teamMember.findUnique({ where: { userId_teamId: { userId, teamId: params.id } } })
    ]);
    if (!targetUser) return jsonError("User not found", 404);
    if (!team) return jsonError("Team not found", 404);
    if (existing) throw new Error("DUPLICATE_TEAM_MEMBER");

    const member = await prisma.teamMember.create({
      data: { userId, teamId: params.id, role: body.role },
      include: { user: { select: { id: true, name: true, email: true, role: true } } }
    });
    await createAuditLog({
      userId: user.id,
      action: "TEAM_MEMBER_ADDED",
      details: { teamId: params.id, teamName: team.name, userId, role: body.role }
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
