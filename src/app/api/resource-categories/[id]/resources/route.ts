import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { getCategoryDescendantIds } from "@/lib/taxonomy";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const includeDescendants = new URL(request.url).searchParams.get("include_descendants") !== "false";
    const ids = includeDescendants ? await getCategoryDescendantIds(params.id) : [params.id];
    const resources = await prisma.resource.findMany({
      where: { primaryCategoryId: { in: ids }, archivedAt: null },
      include: { owner: true, team: true, primaryCategory: { include: { parent: { include: { parent: true } } } } },
      orderBy: { updatedAt: "desc" }
    });
    return NextResponse.json({ resources });
  } catch (error) {
    return routeError(error);
  }
}
