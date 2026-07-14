import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassificationBadge, StatusBadge } from "@/components/badge";
import { PageShell } from "@/components/page-shell";
import { TeamArchiveButton } from "@/components/team-archive-button";
import { TeamEditForm } from "@/components/team-edit-form";
import { TeamMembersManager } from "@/components/team-members-manager";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { visibleTeamWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWorkflowState, humanizeEnum, workflowStateClass, workflowStateLabel } from "@/lib/resource-metadata";
import { GenericBadge } from "@/components/generic-badge";

export default async function TeamDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const team = await prisma.team.findFirst({
    where: { id: params.id, ...visibleTeamWhere(user) },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: "asc" }
      },
      resources: {
        where: { archivedAt: null },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" }
      },
      projects: {
        where: { archivedAt: null },
        include: { leadUser: true, _count: { select: { resources: true, collaborators: true } } },
        orderBy: { updatedAt: "desc" }
      },
      _count: { select: { members: true, resources: true, projects: true } }
    }
  });

  if (!team) redirect("/teams");

  const [users, auditLogs] = await Promise.all([
    user.role === "ADMIN"
      ? prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true } })
      : Promise.resolve([]),
    user.role === "ADMIN"
      ? prisma.auditLog.findMany({
          where: {
            OR: [
              { details: { path: ["teamId"], equals: team.id } },
              { details: { path: ["teamName"], equals: team.name } }
            ]
          },
          include: { user: true },
          orderBy: { createdAt: "desc" },
          take: 25
        })
      : Promise.resolve([])
  ]);

  return (
    <PageShell
      title={team.name}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href={`/teams/${team.id}/presentation`}>Presentation Brief</Link>
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href="/teams">Back to Teams</Link>
        </div>
      }
    >
      <section className="grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-xs font-semibold uppercase text-slate-500">Description</div>
          <p className="mt-2 text-slate-700">{team.description || "No description"}</p>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Members</div>
          <div className="mt-2 text-2xl font-bold">{team._count.members}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Resources</div>
          <div className="mt-2 text-2xl font-bold">{team._count.resources}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Projects</div>
          <div className="mt-2 text-2xl font-bold">{team._count.projects}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Created</div>
          <div className="mt-2">{formatDate(team.createdAt)}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">Updated</div>
          <div className="mt-2">{formatDate(team.updatedAt)}</div>
        </div>
      </section>

      <div className="mt-6 grid gap-6">
        {user.role === "ADMIN" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <TeamEditForm team={{ id: team.id, name: team.name, description: team.description }} />
            <section className="rounded-lg border border-line bg-white p-5">
              <h2 className="text-lg font-bold">Admin Actions</h2>
              <p className="mt-2 text-sm text-slate-600">Archive keeps existing resources and history linked to this team.</p>
              <div className="mt-4"><TeamArchiveButton teamId={team.id} /></div>
            </section>
          </div>
        )}

        {user.role === "ADMIN" ? (
          <TeamMembersManager teamId={team.id} members={team.members} users={users} />
        ) : (
          <section className="rounded-lg border border-line bg-white p-5" id="members">
            <h2 className="text-lg font-bold">Members</h2>
            <div className="mt-4 grid gap-2 text-sm">
              {team.members.map((member) => <div key={member.id}>{member.user.name} - {member.user.email} - {humanizeEnum(member.role)}</div>)}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Projects</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-panel text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">Project</th><th>Lead</th><th>Origin</th><th>Ownership</th><th>Resources</th><th>Collaborators</th></tr>
              </thead>
              <tbody>
                {team.projects.map((project) => (
                  <tr key={project.id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold"><Link className="hover:underline" href={`/projects/${project.id}`}>{project.name}</Link></td>
                    <td>{project.leadUser.name}</td>
                    <td>{humanizeEnum(project.origin)}</td>
                    <td>{humanizeEnum(project.ownershipStatus)}</td>
                    <td>{project._count.resources}</td>
                    <td>{project._count.collaborators}</td>
                  </tr>
                ))}
                {!team.projects.length && <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={6}>No active projects owned by this team.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Resources</h2>
          <div className="mt-3 overflow-x-auto rounded-md border border-line">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="bg-panel text-xs uppercase text-slate-500">
                <tr><th className="px-3 py-2">Resource</th><th>Type</th><th>Classification</th><th>Status</th><th>Latest</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {team.resources.map((resource) => {
                  const workflowState = getWorkflowState(resource);
                  return (
                  <tr key={resource.id} className="border-t border-line">
                    <td className="px-3 py-2 font-semibold"><Link className="hover:underline" href={`/resources/${resource.id}`}>{resource.name}</Link><div className="mt-1"><GenericBadge value={workflowStateLabel(workflowState)} className={workflowStateClass(workflowState)} humanize={false} /></div></td>
                    <td><GenericBadge value={resource.resourceType} /></td>
                    <td><ClassificationBadge value={resource.classification} /></td>
                    <td><StatusBadge value={resource.status} /></td>
                    <td>{resource.versions[0]?.versionName ?? "-"}</td>
                    <td>{formatDate(resource.updatedAt)}</td>
                  </tr>
                  );
                })}
                {!team.resources.length && <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={6}>No active resources owned by this team.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {user.role === "ADMIN" && (
          <section className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-lg font-bold">Team Audit Logs</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {auditLogs.map((log) => (
                <div key={log.id} className="grid gap-1 border-b border-line py-2 md:grid-cols-3">
                  <div className="font-semibold">{log.action}</div>
                  <div>{log.user.name}</div>
                  <div className="text-slate-500">{formatDate(log.createdAt)}</div>
                </div>
              ))}
              {!auditLogs.length && <div className="text-slate-500">No team audit logs yet.</div>}
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}
