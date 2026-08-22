import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { TeamArchiveButton } from "@/components/team-archive-button";
import { TeamEditForm } from "@/components/team-edit-form";
import { TeamMembersManager } from "@/components/team-members-manager";
import { GenericBadge } from "@/components/generic-badge";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { visibleTeamWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { humanizeEnum } from "@/lib/resource-metadata";

export default async function TeamDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const team = await prisma.team.findFirst({
    where: { id: params.id, ...visibleTeamWhere(user) },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: "asc" } },
      resources: {
        where: { resourceType: "DOCUMENT", archivedAt: null },
        include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 }, approvalRequests: { where: { type: "RESOURCE_STORAGE", status: "PENDING" }, select: { id: true } } },
        orderBy: { updatedAt: "desc" }
      }
    }
  });
  if (!team) redirect("/teams");

  const users = user.role === "ADMIN" ? await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, email: true, role: true } }) : [];

  return (
    <PageShell title={team.name} description={team.description || "Team documentation workspace."} actions={<Link className="rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold" href="/teams">Back to Teams</Link>}>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface rounded-lg p-4"><div className="muted-label">Members</div><div className="mt-2 text-2xl font-bold">{team.members.length}</div></div>
        <div className="surface rounded-lg p-4"><div className="muted-label">Documents</div><div className="mt-2 text-2xl font-bold">{team.resources.length}</div></div>
        <div className="surface rounded-lg p-4"><div className="muted-label">Current documents</div><div className="mt-2 text-2xl font-bold text-green-700">{team.resources.filter((document) => document.officialStorageLocation).length}</div></div>
      </div>

      {user.role === "ADMIN" && <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]"><TeamEditForm team={{ id: team.id, name: team.name, description: team.description }} /><section className="rounded-lg border border-line bg-white p-5"><h2 className="text-lg font-bold">Admin actions</h2><p className="mt-2 text-sm text-slate-600">Archiving keeps document history linked to this team.</p><div className="mt-4"><TeamArchiveButton teamId={team.id} /></div></section></div>}

      <div className="mt-6">
        {user.role === "ADMIN" ? <TeamMembersManager teamId={team.id} members={team.members} users={users} /> : <section className="rounded-lg border border-line bg-white p-5" id="members"><h2 className="text-lg font-bold">Members</h2><div className="mt-4 grid gap-2 text-sm">{team.members.map((member) => <div key={member.id}>{member.user.name} - {member.user.email} - {humanizeEnum(member.role)}</div>)}</div></section>}
      </div>

      <section className="mt-6 rounded-lg border border-line bg-white p-5">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Documents</h2>{(user.role === "ADMIN" || user.role === "CONTRIBUTOR") && <Link className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white" href="/resources/new">Upload document</Link>}</div>
        <div className="mt-3 overflow-x-auto rounded-md border border-line">
          <table className="data-table min-w-[720px]"><thead><tr><th>Document</th><th>Latest version</th><th>Status</th><th>Access</th><th>Updated</th></tr></thead>
            <tbody>{team.resources.map((document) => {
              const status = document.approvalRequests.length ? (document.officialStorageLocation ? "Update pending" : "Awaiting review") : document.officialStorageLocation ? "Current" : "Draft";
              return <tr key={document.id}><td><Link className="font-semibold hover:underline" href={`/resources/${document.id}`}>{document.name}</Link></td><td>{document.versions[0]?.versionName ?? "-"}</td><td><GenericBadge value={status} className={status === "Current" ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-800 border-amber-200"} humanize={false} /></td><td>{document.visibility === "ORGANIZATION" ? "Organization" : "Team only"}</td><td>{formatDate(document.updatedAt)}</td></tr>;
            })}{!team.resources.length && <tr><td colSpan={5} className="py-8 text-center text-slate-500">This team has no documents yet.</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
