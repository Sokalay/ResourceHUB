import Link from "next/link";
import { redirect } from "next/navigation";
import { Classification, ResourceType } from "@prisma/client";
import { ClassificationBadge } from "@/components/badge";
import { GenericBadge } from "@/components/generic-badge";
import { PageShell } from "@/components/page-shell";
import { PrintButton } from "@/components/print-button";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { visibleTeamWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  getStorageStatus,
  getWorkflowState,
  humanizeEnum,
  storageStatusClass,
  storageStatusLabel,
  workflowStateClass,
  workflowStateLabel
} from "@/lib/resource-metadata";

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => {
    acc[item] = (acc[item] ?? 0) + 1;
    return acc;
  }, {});
}

function MetricCard({ label, value, description }: { label: string; value: number | string; description: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{description}</div>
    </div>
  );
}

function Slide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="presentation-slide rounded-xl border border-line bg-white p-7 shadow-sm">
      <h2 className="text-2xl font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ResourceList({ resources, emptyText }: { resources: any[]; emptyText: string }) {
  return (
    <div className="grid gap-3">
      {resources.map((resource) => {
        const workflowState = getWorkflowState(resource);
        const storageStatus = getStorageStatus(resource);
        return (
          <Link className="rounded-lg border border-line p-4 hover:bg-panel" href={`/resources/${resource.id}`} key={resource.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{resource.name}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  <GenericBadge value={resource.resourceType} />
                  <ClassificationBadge value={resource.classification} />
                  <GenericBadge value={workflowStateLabel(workflowState)} className={workflowStateClass(workflowState)} humanize={false} />
                  <GenericBadge value={storageStatusLabel(storageStatus)} className={storageStatusClass(storageStatus)} humanize={false} />
                </div>
              </div>
              <div className="text-sm text-slate-500">{formatDate(resource.updatedAt)}</div>
            </div>
          </Link>
        );
      })}
      {!resources.length && <div className="rounded-lg border border-line bg-panel p-4 text-sm text-slate-600">{emptyText}</div>}
    </div>
  );
}

export default async function TeamPresentationPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const team = await prisma.team.findFirst({
    where: { id: params.id, ...visibleTeamWhere(user) },
    include: {
      members: { include: { user: { select: { name: true, email: true, role: true } } }, orderBy: { createdAt: "asc" } },
      resources: {
        where: { archivedAt: null },
        include: {
          approvalRequests: { where: { status: "PENDING" }, include: { requestedBy: true }, orderBy: { createdAt: "asc" } },
          files: { select: { id: true } },
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
          transferJobs: { orderBy: { createdAt: "desc" }, take: 1 },
          tags: true
        },
        orderBy: { updatedAt: "desc" }
      },
      _count: { select: { members: true, resources: true } }
    }
  });

  if (!team) redirect("/teams");

  const resources = team.resources;
  const workflowCounts = countBy(resources.map((resource) => getWorkflowState(resource)));
  const classificationCounts = countBy(resources.map((resource) => resource.classification));
  const typeCounts = countBy(resources.map((resource) => resource.resourceType));
  const pendingResources = resources.filter((resource) => resource.approvalRequests.length > 0 || ["STORAGE_APPROVAL_PENDING", "EXTERNAL_ACCESS_REVIEW", "PUBLIC_APPROVAL_PENDING", "VISITOR_APPROVAL_PENDING"].includes(getWorkflowState(resource)));
  const officialResources = resources.filter((resource) => getWorkflowState(resource) === "OFFICIALLY_STORED");
  const sensitiveResources = resources.filter((resource) => resource.classification === Classification.CONFIDENTIAL || resource.classification === Classification.RESTRICTED);
  const recentResources = resources.slice(0, 6);
  const sourceOnlyResources = resources.filter((resource) => getStorageStatus(resource) === "EXTERNAL_ONLY");

  return (
    <PageShell
      title={`${team.name} Presentation Brief`}
      actions={
        <div className="no-print flex flex-wrap gap-2">
          <PrintButton />
          <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href={`/teams/${team.id}`}>Back to Team</Link>
        </div>
      }
    >
      <div className="no-print mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Use your browser print command to save this brief as PDF. The printed version hides navigation and page controls.
      </div>

      <div className="grid gap-6">
        <Slide title="Team Overview">
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Members" value={team._count.members} description="People assigned to this team" />
            <MetricCard label="Resources" value={resources.length} description="Active resources owned by team" />
            <MetricCard label="Pending Review" value={pendingResources.length} description="Needs approval or access review" />
            <MetricCard label="Officially Stored" value={officialResources.length} description="Approved official resources" />
          </div>
          <p className="mt-5 text-slate-700">{team.description || "No team description available."}</p>
          <div className="mt-5 grid gap-2 text-sm md:grid-cols-2">
            {team.members.map((member) => (
              <div className="rounded-md border border-line bg-panel p-3" key={`${member.user.email}-${member.role}`}>
                <div className="font-semibold">{member.user.name}</div>
                <div className="text-slate-500">{humanizeEnum(member.role)} · {humanizeEnum(member.user.role)}</div>
              </div>
            ))}
          </div>
        </Slide>

        <Slide title="Workflow Summary">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-line p-4">
              <h3 className="font-semibold">By Workflow State</h3>
              <div className="mt-3 grid gap-2 text-sm">
                {Object.entries(workflowCounts).map(([state, count]) => (
                  <div className="flex items-center justify-between border-b border-line pb-2" key={state}>
                    <GenericBadge value={workflowStateLabel(state as any)} className={workflowStateClass(state as any)} humanize={false} />
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-line p-4">
              <h3 className="font-semibold">By Classification</h3>
              <div className="mt-3 grid gap-2 text-sm">
                {Object.values(Classification).map((classification) => (
                  <div className="flex items-center justify-between border-b border-line pb-2" key={classification}>
                    <ClassificationBadge value={classification} />
                    <span className="font-semibold">{classificationCounts[classification] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-line p-4">
            <h3 className="font-semibold">By Resource Type</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.values(ResourceType).map((type) => (
                <span className="rounded-md border border-line bg-panel px-3 py-2 text-sm" key={type}>{humanizeEnum(type)}: <strong>{typeCounts[type] ?? 0}</strong></span>
              ))}
            </div>
          </div>
        </Slide>

        <Slide title="Pending Reviews And Next Actions">
          <ResourceList resources={pendingResources} emptyText="No pending reviews for this team." />
        </Slide>

        <Slide title="Officially Stored Resources">
          <ResourceList resources={officialResources} emptyText="No officially stored resources yet." />
        </Slide>

        <Slide title="Sensitive Resources">
          <ResourceList resources={sensitiveResources} emptyText="No confidential or restricted resources in this team." />
        </Slide>

        <Slide title="Recently Updated Resources">
          <ResourceList resources={recentResources} emptyText="No resources available." />
        </Slide>

        <Slide title="Source-Only Resources Needing Storage Decision">
          <ResourceList resources={sourceOnlyResources} emptyText="No source-only resources need review." />
        </Slide>
      </div>
    </PageShell>
  );
}
