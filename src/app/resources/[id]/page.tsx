import Link from "next/link";
import { redirect } from "next/navigation";
import { ClassificationBadge, StatusBadge } from "@/components/badge";
import { ExternalLinkForm } from "@/components/external-link-form";
import { GenericBadge } from "@/components/generic-badge";
import { PageShell } from "@/components/page-shell";
import { ResourceApprovalActions } from "@/components/resource-approval-actions";
import { UploadForm } from "@/components/upload-form";
import { getCurrentUser } from "@/lib/auth";
import { formatBytes, formatDate } from "@/lib/format";
import { canApproveTeamResource, canManageResource, canViewResource, isTeamOwner } from "@/lib/permissions";
import { getStorageStatus, getWorkflowState, sourceReadinessMessage, workflowStateClass, workflowStateLabel } from "@/lib/resource-metadata";
import { prisma } from "@/lib/prisma";
import { categoryPath } from "@/lib/taxonomy";

export default async function ResourceDetailPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const resource = await prisma.resource.findUnique({
    where: { id: params.id },
    include: {
      owner: true,
      team: true,
      project: { include: { collaborators: true } },
      contributedByTeam: true,
      createdBy: true,
      primaryCategory: { include: { parent: { include: { parent: true } } } },
      tags: true,
      versions: { orderBy: { versionNumber: "desc" }, include: { files: true, createdBy: true } },
      files: { orderBy: { uploadedAt: "desc" }, include: { uploadedBy: true } },
      transferJobs: { orderBy: { createdAt: "desc" } },
      approvalRequests: { orderBy: { createdAt: "desc" }, include: { requestedBy: true, reviewedBy: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 50, include: { user: true } }
    }
  });
  if (!resource || !canViewResource(user, resource)) redirect("/resources");
  const canManage = canManageResource(user, resource);
  const canApproveStorage = canApproveTeamResource(user, resource);
  const canManageVisibility = user.role === "ADMIN" || isTeamOwner(user, resource.teamId);
  const latestVersion = resource.versions[0];
  const workflowState = getWorkflowState(resource);
  const totalSize = resource.files.reduce((sum, file) => sum + Number(file.fileSizeBytes), 0);
  const fullCategoryPath = categoryPath(resource.primaryCategory);
  const categoryLevels = fullCategoryPath === "-" ? [] : fullCategoryPath.split(" / ");
  const activeTab = searchParams.tab ?? "versions";

  return (
    <PageShell
      title={resource.name}
      actions={canManage && <Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href={`/resources/${resource.id}/edit`}>Edit Metadata</Link>}
    >
      <section className="rounded-lg border border-line bg-white p-5">
        <div className="flex flex-wrap gap-2">
          <StatusBadge value={resource.status} />
          <ClassificationBadge value={resource.classification} />
          <GenericBadge value={resource.sourceProvider} />
          <GenericBadge value={resource.storageProvider} />
          <GenericBadge value={getStorageStatus(resource)} />
          <GenericBadge value={workflowStateLabel(workflowState)} className={workflowStateClass(workflowState)} humanize={false} />
          <GenericBadge value={resource.visibility} />
          {resource.pendingVisibility && <GenericBadge value={`Pending ${resource.pendingVisibility}`} className="border-amber-200 bg-amber-50 text-amber-800" humanize={false} />}
        </div>
        <p className="mt-4 text-slate-700">{resource.description || "No description"}</p>
      </section>

      <section className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-3">
        <div><div className="text-xs font-semibold uppercase text-slate-500">Resource Type</div><div className="mt-2 font-semibold">{resource.resourceType}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Team</div><div className="mt-2">{resource.team.name}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Project</div><div className="mt-2">{resource.project ? <Link className="font-semibold text-blue-700 hover:underline" href={`/projects/${resource.project.id}`}>{resource.project.name}</Link> : "-"}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Owner</div><div className="mt-2">{resource.owner.name}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Created By</div><div className="mt-2">{resource.createdBy.name}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Contributing Team</div><div className="mt-2">{resource.contributedByTeam?.name ?? "-"}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Created</div><div className="mt-2">{formatDate(resource.createdAt)}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Updated</div><div className="mt-2">{formatDate(resource.updatedAt)}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Visibility</div><div className="mt-2"><GenericBadge value={resource.visibility} /></div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Storage Handling</div><div className="mt-2"><GenericBadge value={resource.storageHandling} /></div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Source Access</div><div className="mt-2">{resource.sourceAccessGranted ? "Granted by submitter" : "Not confirmed"}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Team Approved</div><div className="mt-2">{formatDate(resource.teamApprovedAt)}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Admin Approved</div><div className="mt-2">{formatDate(resource.adminApprovedAt)}</div></div>
        <div className="md:col-span-3"><div className="text-xs font-semibold uppercase text-slate-500">Tags</div><div className="mt-2 flex flex-wrap gap-2">{resource.tags.length ? resource.tags.map((tag) => <GenericBadge key={tag.id} value={tag.name} />) : "-"}</div></div>
      </section>

      <ResourceApprovalActions
        resourceId={resource.id}
        currentVisibility={resource.visibility}
        pendingVisibility={resource.pendingVisibility}
        canApproveStorage={canApproveStorage}
        canManageVisibility={canManageVisibility}
        isAdmin={user.role === "ADMIN"}
        approvalRequests={resource.approvalRequests}
      />

      <section className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-4">
        <h2 className="text-lg font-bold md:col-span-4">Category Information</h2>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Main Domain</div><div className="mt-2">{categoryLevels[0] ?? "-"}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Area / Field</div><div className="mt-2">{categoryLevels[1] ?? "-"}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Task / Subcategory</div><div className="mt-2">{categoryLevels[2] ?? "-"}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Full Path</div><div className="mt-2">{fullCategoryPath === "-" ? "This resource is uncategorized." : fullCategoryPath}</div>{fullCategoryPath === "-" && user.role === "ADMIN" && <Link className="mt-2 inline-flex text-sm font-semibold text-blue-700" href={`/resources/${resource.id}/edit`}>Set Category</Link>}</div>
      </section>

      <section className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-3">
        <h2 className="text-lg font-bold md:col-span-3">Source Information</h2>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Source Provider</div><div className="mt-2"><GenericBadge value={resource.sourceProvider} /></div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Source Kind</div><div className="mt-2"><GenericBadge value={resource.sourceKind} /></div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Readiness</div><div className="mt-2 text-sm text-slate-700">{sourceReadinessMessage(resource.sourceProvider)}</div></div>
        <div className="md:col-span-3"><div className="text-xs font-semibold uppercase text-slate-500">Source URL / Current Working Location</div><p className="mt-2 break-all font-mono text-sm">{resource.sourceUrl || resource.currentWorkingLocation || "-"}</p></div>
      </section>

      <section className="mt-6 grid gap-4 rounded-lg border border-line bg-white p-5 md:grid-cols-4">
        <h2 className="text-lg font-bold md:col-span-4">Official Storage</h2>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Provider</div><div className="mt-2"><GenericBadge value={resource.storageProvider} /></div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Storage Status</div><div className="mt-2"><GenericBadge value={getStorageStatus(resource)} /></div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Latest Version</div><div className="mt-2">{latestVersion?.versionName ?? "-"}</div></div>
        <div><div className="text-xs font-semibold uppercase text-slate-500">Total Files / Size</div><div className="mt-2">{resource.files.length} / {formatBytes(totalSize)}</div></div>
        <div className="md:col-span-4"><div className="text-xs font-semibold uppercase text-slate-500">Staging Storage</div><p className="mt-2 break-all font-mono text-sm">{resource.stagingStorageLocation || "-"}</p></div>
        <div className="md:col-span-4"><div className="text-xs font-semibold uppercase text-slate-500">Official Resource Hub Storage</div><p className="mt-2 break-all font-mono text-sm">{resource.officialStorageLocation || "-"}</p></div>
        <div className="md:col-span-2"><div className="text-xs font-semibold uppercase text-slate-500">Access Instructions</div><p className="mt-2 whitespace-pre-wrap text-sm">{resource.sourceAccessInstructions || "-"}</p></div>
        <div className="md:col-span-2"><div className="text-xs font-semibold uppercase text-slate-500">Storage Decision Notes</div><p className="mt-2 whitespace-pre-wrap text-sm">{resource.storageDecisionNotes || "-"}</p></div>
      </section>

      {canManage && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div id="upload"><UploadForm resourceId={resource.id} /></div>
          <div id="external"><ExternalLinkForm resourceId={resource.id} /></div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line">
        {[
          ["versions", "Versions"],
          ["files", "Files"],
          ["transfers", "Transfer Jobs"],
          ...(user.role === "ADMIN" ? [["audit", "Audit Logs"]] : [])
        ].map(([tab, label]) => (
          <Link key={tab} className={`px-3 py-2 text-sm font-semibold ${activeTab === tab ? "border-b-2 border-ink" : ""}`} href={`/resources/${resource.id}?tab=${tab}`}>
            {label}
          </Link>
        ))}
      </div>

      {activeTab === "versions" && <section className="mt-4 rounded-lg border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Versions</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Version</th><th>Number</th><th>Description</th><th>Files</th><th>Size</th><th>Created By</th><th>Created</th></tr></thead>
            <tbody>
              {resource.versions.map((version) => <tr key={version.id} className="border-t border-line"><td className="px-3 py-2 font-semibold">{version.versionName}</td><td>{version.versionNumber}</td><td>{version.description || "-"}</td><td>{version.fileCount}</td><td>{formatBytes(version.totalSizeBytes)}</td><td>{version.createdBy.name}</td><td>{formatDate(version.createdAt)}</td></tr>)}
              {!resource.versions.length && <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={7}>No versions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}

      {activeTab === "files" && <section className="mt-4 rounded-lg border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Files</h2>
        <div className="mt-3 overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Original</th><th>Stored</th><th>Type</th><th>MIME</th><th>Size</th><th>SHA-256</th><th>Storage Path</th><th>Uploaded By</th><th>Uploaded</th><th>Action</th></tr></thead>
            <tbody>
              {resource.files.map((file) => (
                <tr key={file.id} className="border-t border-line">
                  <td className="px-3 py-2">{file.originalFileName}</td><td>{file.storedFileName}</td><td>{file.fileType}</td><td>{file.mimeType || "-"}</td><td>{formatBytes(file.fileSizeBytes)}</td><td className="max-w-xs truncate font-mono text-xs">{file.checksumSha256}</td><td className="max-w-xs truncate font-mono text-xs">{file.storagePath}</td><td>{file.uploadedBy.name}</td><td>{formatDate(file.uploadedAt)}</td><td><a className="font-semibold text-blue-700 hover:underline" href={`/api/files/${file.id}/download`}>Download</a></td>
                </tr>
              ))}
              {!resource.files.length && <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={10}>No files stored.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}

      {activeTab === "transfers" && <section className="mt-4 rounded-lg border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Transfer Jobs</h2>
        <div className="mt-3 overflow-hidden rounded-md border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase text-slate-500"><tr><th className="px-3 py-2">Source</th><th>Location</th><th>Destination</th><th>Status</th><th>Started</th><th>Completed</th><th>Error</th></tr></thead>
            <tbody>
              {resource.transferJobs.map((job) => <tr key={job.id} className="border-t border-line"><td className="px-3 py-2">{job.sourceType}</td><td className="break-all">{job.sourceLocation}</td><td>{job.destinationLocation || "-"}</td><td>{job.status}</td><td>{formatDate(job.startedAt)}</td><td>{formatDate(job.completedAt)}</td><td>{job.errorMessage || "-"}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>}

      {user.role === "ADMIN" && activeTab === "audit" && (
        <section className="mt-4 rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Audit Log</h2>
          <div className="mt-3 grid gap-2 text-sm">
            {resource.auditLogs.map((log) => <div key={log.id} className="grid gap-1 border-b border-line py-2 md:grid-cols-3"><div className="font-semibold">{log.action}</div><div>{log.user.name}</div><div className="text-slate-500">{formatDate(log.createdAt)}</div></div>)}
          </div>
        </section>
      )}
    </PageShell>
  );
}
