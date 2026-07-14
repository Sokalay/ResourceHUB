import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassificationBadge, StatusBadge } from "@/components/badge";
import { GenericBadge } from "@/components/generic-badge";
import { PageShell } from "@/components/page-shell";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { approvalTypeLabel, getStorageStatus, getWorkflowState, storageStatusClass, storageStatusLabel, workflowStateClass, workflowStateLabel } from "@/lib/resource-metadata";
import { visibleResourceWhere, visibleTeamWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { categoryPath } from "@/lib/taxonomy";

function StatCard({ label, value, description, tone = "default" }: { label: string; value: number | string; description: string; tone?: "default" | "green" | "amber" | "red" }) {
  const toneClass = {
    default: "border-line bg-white",
    green: "border-green-200 bg-green-50",
    amber: "border-amber-200 bg-amber-50",
    red: "border-red-200 bg-red-50"
  }[tone];
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <div className="muted-label">{label}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-slate-600">{description}</div>
    </div>
  );
}

function ResourceRows({ resources, emptyText }: { resources: any[]; emptyText: string }) {
  return (
    <div className="surface overflow-x-auto rounded-lg">
      <table className="data-table min-w-[820px]">
        <thead>
          <tr><th>Resource</th><th>Category</th><th>Storage</th><th>Status</th><th>Team</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const storageStatus = getStorageStatus(resource);
            const workflowState = getWorkflowState(resource);
            return (
              <tr key={resource.id}>
                <td>
                  <Link className="font-semibold hover:underline" href={`/resources/${resource.id}`}>{resource.name}</Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <GenericBadge value={resource.resourceType} />
                    <GenericBadge value={workflowStateLabel(workflowState)} className={workflowStateClass(workflowState)} humanize={false} />
                    {resource.classification !== "PUBLIC" && <ClassificationBadge value={resource.classification} />}
                  </div>
                </td>
                <td>{categoryPath(resource.primaryCategory) === "-" ? <span className="text-amber-800">Uncategorized</span> : categoryPath(resource.primaryCategory)}</td>
                <td><GenericBadge value={storageStatusLabel(storageStatus)} className={storageStatusClass(storageStatus)} humanize={false} /></td>
                <td><StatusBadge value={resource.status} /></td>
                <td>{resource.team.name}</td>
                <td>{formatRelativeTime(resource.updatedAt)}</td>
              </tr>
            );
          })}
          {!resources.length && <tr><td className="py-8 text-center text-slate-500" colSpan={6}>{emptyText}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const resourceWhere = { AND: [visibleResourceWhere(user), { archivedAt: null }] };
  const resources = await prisma.resource.findMany({
    where: resourceWhere,
    include: {
      owner: true,
      team: true,
      primaryCategory: { include: { parent: { include: { parent: true } } } },
      files: { select: { id: true } },
      transferJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      approvalRequests: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 1 },
      tags: true
    },
    orderBy: { updatedAt: "desc" },
    take: 250
  });

  const userTeamIds = user.teamMembers.map((member) => member.teamId);
  const ownedTeamIds = user.teamMembers.filter((member) => member.role === "OWNER").map((member) => member.teamId);
  const teamOwnerMode = user.role !== "ADMIN" && ownedTeamIds.length > 0;
  const myResources = resources.filter((resource) => resource.createdById === user.id || resource.ownerUserId === user.id);
  const teamResources = resources.filter((resource) => userTeamIds.includes(resource.teamId));
  const ownerTeamResources = resources.filter((resource) => ownedTeamIds.includes(resource.teamId));
  const visibleForRole = teamOwnerMode ? ownerTeamResources : user.role === "VIEWER" ? resources : user.role === "CONTRIBUTOR" ? teamResources : resources;
  const storedCount = visibleForRole.filter((resource) => ["HAS_OFFICIAL_COPY", "BOTH_EXTERNAL_AND_OFFICIAL", "LOCAL_ONLY"].includes(getStorageStatus(resource))).length;
  const externalOnlyCount = visibleForRole.filter((resource) => getStorageStatus(resource) === "EXTERNAL_ONLY").length;
  const pendingCount = visibleForRole.filter((resource) => resource.transferJobs[0]?.status === "PENDING").length;
  const pendingApprovalCount = visibleForRole.filter((resource) => resource.approvalRequests.length > 0).length;
  const failedCount = visibleForRole.filter((resource) => resource.status === "FAILED" || resource.transferJobs[0]?.status === "FAILED").length;
  const restrictedCount = visibleForRole.filter((resource) => resource.classification === "RESTRICTED").length;
  const uncategorizedCount = visibleForRole.filter((resource) => !resource.primaryCategoryId).length;

  const [teams, auditLogs, transferJobs] = await Promise.all([
    prisma.team.findMany({
      where: visibleTeamWhere(user),
      include: { members: { include: { user: true } }, _count: { select: { resources: true, members: true } } },
      orderBy: { name: "asc" }
    }),
    user.role === "ADMIN"
      ? prisma.auditLog.findMany({ include: { user: true, resource: true }, orderBy: { createdAt: "desc" }, take: 8 })
      : Promise.resolve([]),
    prisma.transferJob.findMany({
      where: { resource: resourceWhere },
      include: { resource: true },
      orderBy: { createdAt: "desc" },
      take: 8
    })
  ]);

  const title = user.role === "ADMIN" ? "Admin Dashboard" : teamOwnerMode ? "Team Owner Dashboard" : user.role === "CONTRIBUTOR" ? "Contributor Dashboard" : "Viewer Dashboard";
  const subtitle =
    user.role === "ADMIN"
      ? "Organization-wide resource storage, transfers, and governance overview."
      : teamOwnerMode
        ? "Track your team resources, pending transfers, and member coverage."
        : user.role === "CONTRIBUTOR"
          ? "Track your resources and your team's active submissions."
          : "Browse resources you are allowed to view and download.";

  const pendingApprovalRequests = await prisma.approvalRequest.findMany({
    where:
      user.role === "ADMIN"
        ? { status: "PENDING" }
        : ownedTeamIds.length
          ? { status: "PENDING", resource: { teamId: { in: ownedTeamIds } } }
          : { id: "__none__" },
    include: { resource: { include: { team: true } }, requestedBy: true },
    orderBy: { createdAt: "asc" },
    take: 8
  });

  return (
    <PageShell
      title={title}
      description={subtitle}
      actions={
        <div className="flex flex-wrap gap-2">
          {(user.role === "ADMIN" || user.role === "CONTRIBUTOR") && <Link className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/resources/new">Submit Resource</Link>}
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href="/resources">Open Resources</Link>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Visible Resources" value={visibleForRole.length} description="Resources available to this role" />
        <StatCard label="Officially Stored" value={storedCount} description="Official copies available" tone="green" />
        <StatCard label="Needs Review" value={externalOnlyCount + pendingCount} description="Storage or source review" tone="amber" />
        <StatCard label="Pending Approval" value={pendingApprovalCount} description="Uploads or visibility requests" tone={pendingApprovalCount ? "amber" : "default"} />
        <StatCard label="Failed" value={failedCount} description="Failed resources or jobs" tone={failedCount ? "red" : "default"} />
        <StatCard label="Restricted" value={restrictedCount} description="Sensitive visible resources" />
      </div>

      {(user.role === "ADMIN" || teamOwnerMode) && (
        <section className="surface mt-6 rounded-lg p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Pending Approvals</h2>
            <Link className="text-sm font-semibold text-blue-700" href="/resources">Open resources</Link>
          </div>
          <div className="grid gap-2 text-sm">
            {pendingApprovalRequests.map((request) => (
              <Link className="rounded-md border border-line p-3 hover:bg-panel" href={`/resources/${request.resourceId}`} key={request.id}>
                <div className="font-semibold">{request.resource.name}</div>
                <div className="text-slate-500">{approvalTypeLabel(request.type)}{request.requestedVisibility ? ` to ${request.requestedVisibility}` : ""} - {request.resource.team.name} - {request.requestedBy.name}</div>
              </Link>
            ))}
            {!pendingApprovalRequests.length && <div className="text-slate-500">No pending approvals.</div>}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">{user.role === "VIEWER" ? "Recently Updated Resources" : "Resources Needing Attention"}</h2>
            <Link className="text-sm font-semibold text-blue-700" href="/resources">View all</Link>
          </div>
          <ResourceRows
            resources={(failedCount || pendingCount || externalOnlyCount || uncategorizedCount
              ? visibleForRole.filter((resource) => resource.status === "FAILED" || resource.transferJobs[0]?.status === "PENDING" || getStorageStatus(resource) === "EXTERNAL_ONLY" || !resource.primaryCategoryId)
              : visibleForRole).slice(0, 8)}
            emptyText="No resources need attention."
          />
        </section>

        <section className="grid gap-4">
          <div className="surface rounded-lg p-5">
            <h2 className="text-lg font-bold">Quick Actions</h2>
            <div className="mt-4 grid gap-2 text-sm">
              {(user.role === "ADMIN" || user.role === "CONTRIBUTOR") && <Link className="rounded-md border border-line px-3 py-2 font-semibold hover:bg-panel" href="/resources/new">Submit new resource</Link>}
              <Link className="rounded-md border border-line px-3 py-2 font-semibold hover:bg-panel" href="/resources?storage_status=EXTERNAL_ONLY">Review source-only resources</Link>
              <Link className="rounded-md border border-line px-3 py-2 font-semibold hover:bg-panel" href="/transfer-jobs">View transfer jobs</Link>
              {user.role === "ADMIN" && <Link className="rounded-md border border-line px-3 py-2 font-semibold hover:bg-panel" href="/categories">Manage categories</Link>}
              {teamOwnerMode && <Link className="rounded-md border border-line px-3 py-2 font-semibold hover:bg-panel" href={`/teams/${ownedTeamIds[0]}`}>Open my team</Link>}
            </div>
          </div>

          <div className="surface rounded-lg p-5">
            <h2 className="text-lg font-bold">Teams</h2>
            <div className="mt-3 grid gap-3 text-sm">
              {teams.slice(0, 5).map((team) => <Link className="rounded-md border border-line p-3 hover:bg-panel" href={`/teams/${team.id}`} key={team.id}><div className="font-semibold">{team.name}</div><div className="text-slate-500">{team._count.resources} resources - {team._count.members} members</div></Link>)}
              {!teams.length && <div className="text-slate-500">No teams available.</div>}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {user.role !== "VIEWER" && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{teamOwnerMode ? "My Team Resources" : "My / Team Resources"}</h2>
              <Link className="text-sm font-semibold text-blue-700" href="/resources">Open resources</Link>
            </div>
            <ResourceRows resources={(teamOwnerMode ? ownerTeamResources : myResources.length ? myResources : teamResources).slice(0, 6)} emptyText="No resources yet." />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-lg font-bold">{user.role === "ADMIN" ? "Recent Audit Activity" : "Recent Transfer Activity"}</h2>
          <div className="surface rounded-lg p-5">
            <div className="grid gap-3 text-sm">
              {user.role === "ADMIN"
                ? auditLogs.map((log) => <div className="border-b border-line pb-3" key={log.id}><div className="font-semibold">{log.action}</div><div className="text-slate-500">{log.user.name} - {log.resource?.name ?? "System"} - {formatDate(log.createdAt)}</div></div>)
                : transferJobs.map((job) => <div className="border-b border-line pb-3" key={job.id}><div className="font-semibold">{job.resource.name}</div><div className="text-slate-500">{job.sourceType} - {job.status} - {formatDate(job.createdAt)}</div></div>)}
              {user.role === "ADMIN" && !auditLogs.length && <div className="text-slate-500">No audit activity yet.</div>}
              {user.role !== "ADMIN" && !transferJobs.length && <div className="text-slate-500">No transfer activity yet.</div>}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
