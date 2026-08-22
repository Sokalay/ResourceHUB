import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { ResourceApprovalActions } from "@/components/resource-approval-actions";
import { UploadForm } from "@/components/upload-form";
import { GenericBadge } from "@/components/generic-badge";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { canApproveTeamResource, canManageResource, canViewResource, isTeamOwner } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function DocumentDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const document = await prisma.resource.findFirst({
    where: { id: params.id, resourceType: "DOCUMENT" },
    include: {
      team: true,
      owner: true,
      createdBy: true,
      tags: true,
      versions: {
        include: { createdBy: true, files: true },
        orderBy: { versionNumber: "desc" }
      },
      approvalRequests: {
        include: { requestedBy: true },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!document || !canViewResource(user, document)) redirect("/resources");

  const canManage = canManageResource(user, document);
  const canApprove = canApproveTeamResource(user, document);
  const canManageVisibility = user.role === "ADMIN" || isTeamOwner(user, document.teamId);
  const pendingVersion = document.approvalRequests.some((request) => request.type === "RESOURCE_STORAGE" && request.status === "PENDING");
  const currentVersion = document.versions.find((version) => version.storagePath === document.officialStorageLocation);
  const latestVersion = document.versions[0];
  const status = document.archivedAt ? "Archived" : pendingVersion ? (currentVersion ? "Update pending" : "Awaiting review") : currentVersion ? "Current" : "Draft";

  return (
    <PageShell
      title={document.name}
      description={document.description || "No description provided."}
      actions={<div className="flex gap-2"><Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href="/resources">Back to Documents</Link></div>}
    >
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-lg border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-2">
            <GenericBadge value={status} className={status === "Current" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"} humanize={false} />
            <GenericBadge value={document.visibility === "ORGANIZATION" ? "Organization" : "Team only"} />
          </div>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="muted-label">Owning team</dt><dd className="mt-1 font-semibold">{document.team.name}</dd></div>
            <div><dt className="muted-label">Document owner</dt><dd className="mt-1">{document.owner.name}</dd></div>
            <div><dt className="muted-label">Current version</dt><dd className="mt-1 font-semibold">{currentVersion?.versionName ?? "Not published yet"}</dd></div>
            <div><dt className="muted-label">Last updated</dt><dd className="mt-1">{formatDate(document.updatedAt)}</dd></div>
            <div className="sm:col-span-2"><dt className="muted-label">Tags</dt><dd className="mt-2 flex flex-wrap gap-2">{document.tags.map((tag) => <GenericBadge key={tag.id} value={tag.name} humanize={false} />)}{!document.tags.length && <span className="text-slate-500">No tags</span>}</dd></div>
          </dl>
          {latestVersion && latestVersion.id !== currentVersion?.id && <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Version {latestVersion.versionName} has been uploaded and is not yet the current published version.</div>}
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="text-lg font-bold">Current file</h2>
          {currentVersion ? <div className="mt-3 grid gap-2">{currentVersion.files.map((file) => <Link className="rounded-md border border-line p-3 text-sm font-semibold hover:bg-panel" href={`/api/files/${file.id}/download`} key={file.id}>{file.originalFileName}<span className="mt-1 block text-xs font-normal text-slate-500">{Math.ceil(Number(file.fileSizeBytes) / 1024)} KB</span></Link>)}</div> : <p className="mt-3 text-sm text-slate-500">A team owner has not published a current version yet.</p>}
        </section>
      </div>

      {(canApprove || canManageVisibility) && <div className="mt-6"><ResourceApprovalActions resourceId={document.id} currentVisibility={document.visibility} canApproveStorage={canApprove} canManageVisibility={canManageVisibility} approvalRequests={document.approvalRequests} /></div>}

      <section className="mt-6 rounded-lg border border-line bg-white p-5">
        <h2 className="text-lg font-bold">Version history</h2>
        <p className="mt-1 text-sm text-slate-600">Older versions remain available for traceability, while only the published version is treated as current.</p>
        <div className="mt-4 overflow-x-auto rounded-md border border-line">
          <table className="data-table min-w-[760px]">
            <thead><tr><th>Version</th><th>Status</th><th>Change summary</th><th>Uploaded by</th><th>Date</th><th>File</th></tr></thead>
            <tbody>
              {document.versions.map((version) => <tr key={version.id}>
                <td className="font-semibold">{version.versionName}</td>
                <td>{version.id === currentVersion?.id ? <GenericBadge value="Current" className="bg-green-50 text-green-700 border-green-200" humanize={false} /> : version.id === latestVersion?.id && pendingVersion ? <GenericBadge value="Pending review" className="bg-amber-50 text-amber-800 border-amber-200" humanize={false} /> : "Previous"}</td>
                <td>{version.description || "-"}</td>
                <td>{version.createdBy.name}</td>
                <td>{formatDate(version.createdAt)}</td>
                <td>{version.files.map((file) => <Link className="block text-blue-700 hover:underline" href={`/api/files/${file.id}/download`} key={file.id}>{file.originalFileName}</Link>)}</td>
              </tr>)}
              {!document.versions.length && <tr><td colSpan={6} className="py-8 text-center text-slate-500">No versions uploaded.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {canManage && !document.archivedAt && <div className="mt-6"><UploadForm resourceId={document.id} nextVersionNumber={(latestVersion?.versionNumber ?? 0) + 1} /></div>}
    </PageShell>
  );
}
