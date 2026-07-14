import { redirect } from "next/navigation";
import { ResourceForm } from "@/components/resource-form";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { visibleProjectWhere } from "@/lib/project-service";
import { prisma } from "@/lib/prisma";
import { flattenCategoryTree, getCategoryTree } from "@/lib/taxonomy";

export default async function NewResourcePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "VIEWER") redirect("/resources");
  const [users, allTeams, projects, categoryTree] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.team.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.project.findMany({
      where: visibleProjectWhere(user),
      include: { team: true, leadUser: true },
      orderBy: { name: "asc" }
    }),
    getCategoryTree()
  ]);
  const teams = user.role === "ADMIN" ? allTeams : allTeams.filter((team) => user.teamMembers.some((member) => member.teamId === team.id));
  if (!teams.length) redirect("/resources");
  const categories = flattenCategoryTree(categoryTree).map((category) => ({ id: category.id, name: category.name, path: category.path, parentId: category.parentId, level: category.level }));
  return (
    <PageShell title="Submit Resource" description="Create a team-only resource record, then stage an upload or register the external source for review.">
      <ResourceForm users={users} teams={teams} projects={projects} categories={categories} currentUserId={user.id} currentUserName={user.name} isAdmin={user.role === "ADMIN"} />
    </PageShell>
  );
}
