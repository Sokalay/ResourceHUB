import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { routeError } from "@/lib/http";
import { getCategoryTree } from "@/lib/taxonomy";

function serializeNode(node: any): any {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    description: node.description,
    level: node.level,
    parent_id: node.parentId,
    parentId: node.parentId,
    sort_order: node.sortOrder,
    sortOrder: node.sortOrder,
    resource_count: node.resourceCount ?? 0,
    resourceCount: node.resourceCount ?? 0,
    children: node.children.map(serializeNode)
  };
}

export async function GET(request: Request) {
  try {
    await requireUser();
    const includeArchived = new URL(request.url).searchParams.get("include_archived") === "true";
    const tree = await getCategoryTree(includeArchived);
    return NextResponse.json({ tree: tree.map(serializeNode) });
  } catch (error) {
    return routeError(error);
  }
}
