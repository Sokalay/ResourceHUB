import { Prisma, ResourceCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateResourceSlug } from "@/lib/storage";

export type CategoryNode = ResourceCategory & { resourceCount?: number; children: CategoryNode[] };

export function categoryPath(category?: (ResourceCategory & { parent?: ResourceCategory | null }) | null) {
  if (!category) return "-";
  const names: string[] = [category.name];
  let parent = category.parent;
  while (parent) {
    names.unshift(parent.name);
    parent = (parent as ResourceCategory & { parent?: ResourceCategory | null }).parent;
  }
  return names.join(" / ");
}

export function buildCategoryTree(categories: Array<ResourceCategory & { _count?: { resources?: number } }>) {
  const byId = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];
  for (const category of categories) {
    byId.set(category.id, { ...category, resourceCount: category._count?.resources ?? 0, children: [] });
  }
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function getCategoryTree(includeArchived = false) {
  const categories = await prisma.resourceCategory.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    include: { _count: { select: { resources: true } } },
    orderBy: [{ level: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
  });
  return buildCategoryTree(categories);
}

export async function getCategoryAncestorIds(categoryId: string) {
  const ids: string[] = [];
  let current = await prisma.resourceCategory.findUnique({ where: { id: categoryId } });
  while (current) {
    ids.unshift(current.id);
    current = current.parentId ? await prisma.resourceCategory.findUnique({ where: { id: current.parentId } }) : null;
  }
  return ids;
}

export async function getCategoryPath(categoryId: string | null | undefined) {
  if (!categoryId) return "-";
  const ancestors = await getCategoryAncestorIds(categoryId);
  if (!ancestors.length) return "-";
  const categories = await prisma.resourceCategory.findMany({ where: { id: { in: ancestors } } });
  const byId = new Map(categories.map((category) => [category.id, category.name]));
  return ancestors.map((id) => byId.get(id)).filter(Boolean).join(" / ");
}

export async function getCategoryDescendantIds(categoryId: string) {
  const categories = await prisma.resourceCategory.findMany({
    where: { archivedAt: null },
    select: { id: true, parentId: true }
  });
  const childrenByParent = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category.id]);
  }
  const ids = new Set<string>([categoryId]);
  const queue = [categoryId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const childId of childrenByParent.get(id) ?? []) {
      if (!ids.has(childId)) {
        ids.add(childId);
        queue.push(childId);
      }
    }
  }
  return Array.from(ids);
}

export async function assertCategoryNameAvailable(input: {
  name: string;
  parentId?: string | null;
  categoryId?: string;
  tx?: Prisma.TransactionClient;
}) {
  const tx = input.tx ?? prisma;
  const name = input.name.trim().replace(/\s+/g, " ");
  const slug = generateResourceSlug(name);
  const existing = await tx.resourceCategory.findFirst({
    where: {
      parentId: input.parentId ?? null,
      archivedAt: null,
      ...(input.categoryId ? { id: { not: input.categoryId } } : {}),
      OR: [{ name: { equals: name, mode: "insensitive" } }, { slug }]
    }
  });
  if (existing) throw new Error("CATEGORY_EXISTS");
  return { name, slug };
}

export async function assertNoCircularCategoryParent(categoryId: string, parentId?: string | null) {
  if (!parentId) return;
  if (categoryId === parentId) throw new Error("CIRCULAR_CATEGORY");
  let parent = await prisma.resourceCategory.findUnique({ where: { id: parentId } });
  while (parent) {
    if (parent.parentId === categoryId) throw new Error("CIRCULAR_CATEGORY");
    parent = parent.parentId ? await prisma.resourceCategory.findUnique({ where: { id: parent.parentId } }) : null;
  }
}

export async function recalculateCategoryLevels(categoryId: string, tx: Prisma.TransactionClient = prisma) {
  const category = await tx.resourceCategory.findUnique({ where: { id: categoryId } });
  if (!category) return;
  const parent = category.parentId ? await tx.resourceCategory.findUnique({ where: { id: category.parentId } }) : null;
  const nextLevel = parent ? parent.level + 1 : 1;
  await tx.resourceCategory.update({ where: { id: categoryId }, data: { level: nextLevel } });
  const children = await tx.resourceCategory.findMany({ where: { parentId: categoryId, archivedAt: null } });
  for (const child of children) {
    await recalculateCategoryLevels(child.id, tx);
  }
}

export function flattenCategoryTree(nodes: CategoryNode[], depth = 0): Array<CategoryNode & { depth: number; path: string }> {
  const rows: Array<CategoryNode & { depth: number; path: string }> = [];
  for (const node of nodes) {
    rows.push({ ...node, depth, path: node.name });
    for (const child of flattenCategoryTree(node.children, depth + 1)) {
      rows.push({ ...child, path: `${node.name} / ${child.path}` });
    }
  }
  return rows;
}
