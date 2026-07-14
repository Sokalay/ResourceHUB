import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassificationBadge, StatusBadge } from "@/components/badge";
import { GenericBadge } from "@/components/generic-badge";
import { PageShell } from "@/components/page-shell";
import { ProjectCollaboratorsManager } from "@/components/project-collaborators-manager";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canViewProject } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getStorageStatus, getWorkflowState, humanizeEnum, workflowStateClass, workflowStateLabel } from "@/lib/resource-metadata";

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      team: true,
      leadUser: true,
      createdBy: true,
      collaborators: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      resources: {
        where: { archivedAt: null },
        include: { owner: true, createdBy: true, contributedByTeam: true, transferJobs: { orderBy: { createdAt: "desc" }, take: 1 } },
        orderBy: { updatedAt: "desc" }
      }
    }
  });
  if (!project || !canViewProject(user, project)) redirect("/projects");
  const users = user.role === "ADMIN" ? await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }) : [];
  const pendingResources = project.resources.filter((resource) => resource.status !== "STORED" || resource.transferJobs[0]?.status === "PENDING");

  return (
    <PageShell
      title={project.name}
      description={project.description || "Project workspace for ownership, collaborators, and submitted resources."}
      actions={
        <div className="flex flex-wrap gap-2">
          {(user.role === "ADMIN" || user.role === "CONTRIBUTOR") && <Link className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/resources/new">Submit Resource</Link>}
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href="/projects">Back to Projects</Link>
        </div>
      }
    >
      <section className="surface rounded-lg p-5">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <div className="flex flex-wrap gap-2">
              <GenericBadge value={humanizeEnum(project.origin)} humanize={false} />
              <GenericBadge value={humanizeEnum(project.status)} humanize={false} />
              <GenericBadge value={humanizeEnum(project.provisioningStatus)} humanize={false} />
              <GenericBadge value={humanizeEnum(project.ownershipStatus)} humanize={false} />
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div><div className="muted-label">Owning Team</div><div className="mt-1 font-semibold">{project.team.name}</div></div>
              <div><div className="muted-label">Project Lead</div><div className="mt-1">{project.leadUser.name}</div></div>
              <div><div className="muted-label">Created By</div><div className="mt-1">{project.createdBy.name}</div></div>
              <div><div className="muted-label">Created</div><div className="mt-1">{formatDate(project.createdAt)}</div></div>
              <div><div className="muted-label">Repository Name</div><div className="mt-1 font-mono text-sm">{project.repositoryName || "-"}</div></div>
              <div><div className="muted-label">Repository URL</div><div className="mt-1 break-all font-mono text-sm">{project.repositoryUrl || "-"}</div></div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
            <div className="rounded-md border border-line bg-slate-50 p-4"><div className="muted-label">Resources</div><div className="mt-2 text-2xl font-bold">{project.resources.length}</div></div>
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4"><div className="muted-label">Needs Review</div><div className="mt-2 text-2xl font-bold">{pendingResources.length}</div></div>
            <div className="rounded-md border border-line bg-slate-50 p-4"><div className="muted-label">Collaborators</div><div className="mt-2 text-2xl font-bold">{project.collaborators.length}</div></div>
          </div>
        </div>
      </section>

      {user.role === "ADMIN" && <div className="mt-6"><ProjectCollaboratorsManager projectId={project.id} collaborators={project.collaborators} users={users} /></div>}

      <section className="surface mt-6 rounded-lg p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Project Resources</h2>
          <Link className="text-sm font-semibold text-blue-700" href={`/resources?project_id=${project.id}`}>Open filtered list</Link>
        </div>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="data-table min-w-[900px]">
            <thead><tr><th>Resource</th><th>Type</th><th>Classification</th><th>Status</th><th>Storage</th><th>Contributor</th><th>Updated</th></tr></thead>
            <tbody>
              {project.resources.map((resource) => {
                const workflowState = getWorkflowState(resource);
                return (
                  <tr className="border-t border-line" key={resource.id}>
                    <td><Link className="font-semibold hover:underline" href={`/resources/${resource.id}`}>{resource.name}</Link><div className="mt-1"><GenericBadge value={workflowStateLabel(workflowState)} className={workflowStateClass(workflowState)} humanize={false} /></div></td>
                    <td><GenericBadge value={resource.resourceType} /></td>
                    <td><ClassificationBadge value={resource.classification} /></td>
                    <td><StatusBadge value={resource.status} /></td>
                    <td><GenericBadge value={humanizeEnum(getStorageStatus(resource))} humanize={false} /></td>
                    <td>{resource.createdBy.name}{resource.contributedByTeam ? <div className="text-xs text-slate-500">From {resource.contributedByTeam.name}</div> : null}</td>
                    <td>{formatDate(resource.updatedAt)}</td>
                  </tr>
                );
              })}
              {!project.resources.length && <tr><td className="px-3 py-8 text-center text-slate-500" colSpan={7}>No resources have been submitted to this project yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
