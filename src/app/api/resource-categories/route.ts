import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertCategoryNameAvailable } from "@/lib/taxonomy";

const schema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  parent_id: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  sortOrder: z.number().int().optional().nullable()
});

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("include_archived") === "true";
    const level = searchParams.get("level");
    const parentId = searchParams.get("parent_id");
    const search = searchParams.get("search");
    const categories = await prisma.resourceCategory.findMany({
      where: {
        ...(includeArchived ? {} : { archivedAt: null }),
        ...(level ? { level: Number(level) } : {}),
        ...(parentId ? { parentId } : {}),
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {})
      },
      include: { _count: { select: { children: true, resources: true } } },
      orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });
    return NextResponse.json({ categories });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const body = schema.parse(await request.json());
    const parentId = body.parentId ?? body.parent_id ?? null;
    const parent = parentId ? await prisma.resourceCategory.findFirst({ where: { id: parentId, archivedAt: null } }) : null;
    if (parentId && !parent) return jsonError("Parent category not found", 404);
    const { name, slug } = await assertCategoryNameAvailable({ name: body.name, parentId });
    const category = await prisma.resourceCategory.create({
      data: {
        name,
        slug,
        description: body.description || null,
        parentId,
        level: parent ? parent.level + 1 : 1,
        sortOrder: body.sortOrder ?? body.sort_order ?? null
      }
    });
    await createAuditLog({
      userId: user.id,
      action: "CATEGORY_CREATED",
      details: { categoryId: category.id, categoryName: category.name, parentId: category.parentId }
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
