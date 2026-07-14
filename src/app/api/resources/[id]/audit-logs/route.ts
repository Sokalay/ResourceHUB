import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canViewResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const resource = await prisma.resource.findUniqueOrThrow({ where: { id: params.id } });
    if (!canViewResource(user, resource)) return jsonError("Forbidden", 403);
    const logs = await prisma.auditLog.findMany({
      where: { resourceId: params.id },
      include: { user: true },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ logs });
  } catch (error) {
    return routeError(error);
  }
}
