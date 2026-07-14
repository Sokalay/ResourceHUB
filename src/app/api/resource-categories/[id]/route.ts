import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { jsonError, routeError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { assertCategoryNameAvailable, assertNoCircularCategoryParent, getCategoryPath, recalculateCategoryLevels } from "@/lib/taxonomy";

const schema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  parent_id: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  sort_order: z.number().int().optional().nullable(),
  sortOrder: z.number().int().optional().nullable()
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const existing = await prisma.resourceCategory.findFirst({ where: { id: params.id, archivedAt: null } });
    if (!existing) return jsonError("Category not found", 404);
    const body = schema.parse(await request.json());
    const parentId = body.parentId ?? body.parent_id ?? existing.parentId;
    await assertNoCircularCategoryParent(params.id, parentId);
    const parent = parentId ? await prisma.resourceCategory.findFirst({ where: { id: parentId, archivedAt: null } }) : null;
    if (parentId && !parent) return jsonError("Parent category not found", 404);
    const oldPath = await getCategoryPath(params.id);
    const nextName = body.name ?? existing.name;
    const { name, slug } = await assertCategoryNameAvailable({ name: nextName, parentId, categoryId: params.id });
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.resourceCategory.update({
        where: { id: params.id },
        data: {
          name,
          slug,
          description: body.description === undefined ? existing.description : body.description,
          parentId,
          level: parent ? parent.level + 1 : 1,
          sortOrder: body.sortOrder ?? body.sort_order ?? existing.sortOrder
        }
      });
      await recalculateCategoryLevels(params.id, tx);
      return updated;
    });
    const newPath = await getCategoryPath(params.id);
    if (existing.parentId !== category.parentId) {
      await createAuditLog({
        userId: user.id,
        action: "CATEGORY_MOVED",
        details: { categoryId: params.id, oldParentId: existing.parentId, newParentId: category.parentId, oldPath, newPath }
      });
    }
    await createAuditLog({
      userId: user.id,
      action: "CATEGORY_UPDATED",
      details: { categoryId: params.id, oldName: existing.name, newName: category.name, oldParentId: existing.parentId, newParentId: category.parentId, oldPath, newPath }
    });
    return NextResponse.json({ category });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (user.role !== "ADMIN") return jsonError("Forbidden", 403);
    const existing = await prisma.resourceCategory.findFirst({
      where: { id: params.id, archivedAt: null },
      include: { _count: { select: { children: true, resources: true } } }
    });
    if (!existing) return jsonError("Category not found", 404);
    if (existing._count.children > 0) throw new Error("CATEGORY_HAS_CHILDREN");
    const category = await prisma.resourceCategory.update({
      where: { id: params.id },
      data: { archivedAt: new Date() }
    });
    await createAuditLog({
      userId: user.id,
      action: "CATEGORY_ARCHIVED",
      details: { categoryId: params.id, categoryName: category.name, resourceCount: existing._count.resources }
    });
    return NextResponse.json({ category });
  } catch (error) {
    return routeError(error);
  }
}
