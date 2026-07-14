import Link from "next/link";
import { redirect } from "next/navigation";
import { GenericBadge } from "@/components/generic-badge";
import { PageShell } from "@/components/page-shell";
import { ProjectCreateForm } from "@/components/project-create-form";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { visibleProjectWhere } from "@/lib/project-service";
import { prisma } from "@/lib/prisma";
import { humanizeEnum } from "@/lib/resource-metadata";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [projects, teams, users] = await Promise.all([
    prisma.project.findMany({
      where: visibleProjectWhere(user),
      include: { team: true, leadUser: true, collaborators: { include: { user: true } }, _count: { select: { resources: true, collaborators: true } } },
      orderBy: { updatedAt: "desc" }
    }),
    user.role === "ADMIN" ? prisma.team.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    user.role === "ADMIN" ? prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }) : Promise.resolve([])
  ]);
  const activeCount = projects.filter((project) => project.status === "ACTIVE").length;
  const transferRequiredCount = projects.filter((project) => project.ownershipStatus === "TRANSFER_REQUIRED").length;
  const resourceCount = projects.reduce((sum, project) => sum + project._count.resources, 0);

  return (
    <PageShell
      title="Projects"
      description="Create projects first, keep one owning team, and assign outside contributors only when they need access."
    >
      {user.role === "ADMIN" && <ProjectCreateForm teams={teams} users={users} />}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <div className="surface rounded-lg p-4"><div className="muted-label">Active Projects</div><div className="mt-2 text-2xl font-bold">{activeCount}</div></div>
        <div className="surface rounded-lg p-4"><div className="muted-label">Project Resources</div><div className="mt-2 text-2xl font-bold">{resourceCount}</div></div>
        <div className={`rounded-lg border p-4 ${transferRequiredCount ? "border-amber-200 bg-amber-50" : "border-line bg-white"}`}><div className="muted-label">Transfer Required</div><div className="mt-2 text-2xl font-bold">{transferRequiredCount}</div></div>
      </div>
      <div className="surface mt-6 overflow-x-auto rounded-lg">
        <table className="data-table min-w-[980px]">
          <thead>
            <tr><th>Project</th><th>Governance</th><th>Owning Team</th><th>Lead</th><th>Resources</th><th>Collaborators</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <Link className="font-semibold text-slate-950 hover:underline" href={`/projects/${project.id}`}>{project.name}</Link>
                  <div className="mt-1 max-w-md truncate text-xs text-slate-500">{project.description || "No description"}</div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <GenericBadge value={humanizeEnum(project.origin)} humanize={false} />
                    <GenericBadge value={humanizeEnum(project.ownershipStatus)} humanize={false} />
                  </div>
                </td>
                <td>{project.team.name}</td>
                <td>{project.leadUser.name}</td>
                <td>{project._count.resources}</td>
                <td>{project._count.collaborators}</td>
                <td>{formatDate(project.updatedAt)}</td>
              </tr>
            ))}
            {!projects.length && <tr><td className="py-10 text-center text-slate-500" colSpan={7}>No projects available.</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
