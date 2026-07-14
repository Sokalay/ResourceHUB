import { redirect } from "next/navigation";
import { EditResourceForm } from "@/components/edit-resource-form";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { canManageResource } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { flattenCategoryTree, getCategoryTree } from "@/lib/taxonomy";

export default async function EditResourcePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const resource = await prisma.resource.findUnique({ where: { id: params.id }, include: { tags: true } });
  if (!resource || !canManageResource(user, resource)) redirect(`/resources/${params.id}`);
  const [users, teams, categoryTree] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.team.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    getCategoryTree()
  ]);
  const categories = flattenCategoryTree(categoryTree).map((category) => ({ id: category.id, name: category.name, path: category.path, parentId: category.parentId, level: category.level }));
  return (
    <PageShell title="Edit Resource">
      <EditResourceForm resource={resource} users={users} teams={teams} categories={categories} isAdmin={user.role === "ADMIN"} />
    </PageShell>
  );
}
