import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { visibleResourceWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await requireUser();
    const jobs = await prisma.transferJob.findMany({
      where: { resource: visibleResourceWhere(user) },
      include: { resource: true, createdBy: true },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ jobs });
  } catch (error) {
    return routeError(error);
  }
}
