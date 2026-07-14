import { redirect } from "next/navigation";
import { CategoryManager } from "@/components/category-manager";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { flattenCategoryTree, getCategoryTree } from "@/lib/taxonomy";

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/resources");
  const categories = flattenCategoryTree(await getCategoryTree()).map((category) => ({
    id: category.id,
    name: category.name,
    path: category.path,
    depth: category.depth,
    parentId: category.parentId,
    level: category.level,
    description: category.description,
    sortOrder: category.sortOrder,
    resourceCount: category.resourceCount ?? 0,
    childCount: category.children.length
  }));
  return (
    <PageShell title="Categories">
      <p className="-mt-4 mb-6 text-sm text-slate-600">Manage the taxonomy used to classify resources.</p>
      <CategoryManager categories={categories} />
    </PageShell>
  );
}
