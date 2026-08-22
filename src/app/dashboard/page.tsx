import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { GenericBadge } from "@/components/generic-badge";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { visibleResourceWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const ownedTeamIds = user.teamMembers.filter((member) => member.role === "OWNER").map((member) => member.teamId);

  const documents = await prisma.resource.findMany({
    where: { AND: [visibleResourceWhere(user), { resourceType: "DOCUMENT", archivedAt: null }] },
    include: {
      team: true,
      owner: true,
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      approvalRequests: { where: { type: "RESOURCE_STORAGE", status: "PENDING" }, include: { requestedBy: true } }
    },
    orderBy: { updatedAt: "desc" }
  });
  const current = documents.filter((document) => document.officialStorageLocation).length;
  const pendingDocuments = documents.filter((document) => document.approvalRequests.length > 0);
  const myPending = user.role === "ADMIN" ? pendingDocuments : pendingDocuments.filter((document) => ownedTeamIds.includes(document.teamId));
  const organizationDocuments = documents.filter((document) => document.visibility === "ORGANIZATION").length;

  return (
    <PageShell
      title="Team Documentation"
      description="One trusted place for the latest documents from every team."
      actions={<div className="flex gap-2">{(user.role === "ADMIN" || user.role === "CONTRIBUTOR") && <Link className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/resources/new">Upload Document</Link>}<Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href="/resources">Browse Documents</Link></div>}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <div className="surface rounded-lg p-4"><div className="muted-label">Visible documents</div><div className="mt-2 text-2xl font-bold">{documents.length}</div><div className="mt-1 text-xs text-slate-500">Across teams you can access</div></div>
        <div className="surface rounded-lg border-green-200 bg-green-50 p-4"><div className="muted-label">Current</div><div className="mt-2 text-2xl font-bold">{current}</div><div className="mt-1 text-xs text-slate-500">Trusted published versions</div></div>
        <div className="surface rounded-lg border-amber-200 bg-amber-50 p-4"><div className="muted-label">Waiting for your review</div><div className="mt-2 text-2xl font-bold">{myPending.length}</div><div className="mt-1 text-xs text-slate-500">Versions team owners can publish</div></div>
      </div>

      {myPending.length > 0 && <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold">Waiting for review</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {myPending.map((document) => <Link className="surface rounded-lg p-4 hover:bg-panel" href={`/resources/${document.id}`} key={document.id}><div className="font-semibold">{document.name}</div><div className="mt-1 text-sm text-slate-500">{document.team.name} - uploaded by {document.approvalRequests[0].requestedBy.name}</div></Link>)}
        </div>
      </section>}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Recently updated</h2><Link className="text-sm font-semibold text-blue-700" href="/resources">View all</Link></div>
        <div className="surface overflow-x-auto rounded-lg">
          <table className="data-table min-w-[700px]"><thead><tr><th>Document</th><th>Team</th><th>Version</th><th>Access</th><th>Updated</th></tr></thead>
            <tbody>{documents.slice(0, 10).map((document) => <tr key={document.id}><td><Link className="font-semibold hover:underline" href={`/resources/${document.id}`}>{document.name}</Link>{document.officialStorageLocation && <div className="mt-1"><GenericBadge value="Current" className="bg-green-50 text-green-700 border-green-200" humanize={false} /></div>}</td><td>{document.team.name}</td><td>{document.versions[0]?.versionName ?? "-"}</td><td>{document.visibility === "ORGANIZATION" ? "Organization" : "Team only"}</td><td>{formatDate(document.updatedAt)}</td></tr>)}{!documents.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">No documents yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <div className="font-semibold">Ready for future knowledge search</div>
        <p className="mt-1">Current versions, team ownership, and access rules are being captured now so a future chatbot can answer from trusted documents without using old versions.</p>
      </div>
    </PageShell>
  );
}
