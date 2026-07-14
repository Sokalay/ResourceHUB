import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { canViewAuditLogs } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    if (!canViewAuditLogs(user)) return jsonError("Forbidden", 403);
    const logs = await prisma.auditLog.findMany({
      include: { user: true, resource: true },
      orderBy: { createdAt: "desc" },
      take: 250
    });
    return NextResponse.json({ logs });
  } catch (error) {
    return routeError(error);
  }
}
