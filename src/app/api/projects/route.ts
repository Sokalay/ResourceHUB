import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canManageProjects } from "@/lib/permissions";
import { createProject, visibleProjectWhere } from "@/lib/project-service";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(3).max(120),
  description: z.string().optional().nullable(),
  origin: z.enum(["NEW", "EXISTING"]),
  teamId: z.string().min(1),
  leadUserId: z.string().min(1),
  repositoryUrl: z.string().optional().nullable(),
  repositoryName: z.string().optional().nullable(),
  provisioningStatus: z.enum(["NOT_REQUESTED", "MANUAL_REQUIRED", "READY"]).optional(),
  ownershipStatus: z.enum(["RND_ADMIN_OWNER", "TRANSFER_REQUIRED", "TRANSFER_VERIFIED"]).optional(),
  collaboratorUserIds: z.array(z.string()).optional()
});

export async function GET() {
  try {
    const user = await requireUser();
    const projects = await prisma.project.findMany({
      where: visibleProjectWhere(user),
      include: { team: true, leadUser: true, collaborators: { include: { user: true } }, _count: { select: { resources: true } } },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ projects });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!canManageProjects(user)) return jsonError("Forbidden", 403);
    const body = createSchema.parse(await request.json());
    const team = await prisma.team.findFirst({ where: { id: body.teamId, archivedAt: null } });
    if (!team) return jsonError("Team not found", 404);
    const lead = await prisma.user.findUnique({ where: { id: body.leadUserId } });
    if (!lead) return jsonError("Lead user not found", 404);
    const project = await createProject({ ...body, createdById: user.id });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
