import { redirect } from "next/navigation";
import { ResourceForm } from "@/components/resource-form";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewDocumentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "VIEWER") redirect("/resources");

  const [users, allTeams] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
    prisma.team.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } })
  ]);
  const teams = user.role === "ADMIN" ? allTeams : allTeams.filter((team) => user.teamMembers.some((member) => member.teamId === team.id));
  if (!teams.length) redirect("/resources");

  return (
    <PageShell title="Upload Document" description="Add a document to a team's shared knowledge base and keep future updates in one version history.">
      <ResourceForm users={users} teams={teams} currentUserId={user.id} currentUserName={user.name} isAdmin={user.role === "ADMIN"} />
    </PageShell>
  );
}
