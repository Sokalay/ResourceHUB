import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { GenericBadge } from "@/components/generic-badge";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { visibleResourceWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { humanizeEnum } from "@/lib/resource-metadata";

function stateOf(document: { officialStorageLocation: string | null; approvalRequests: { id: string }[]; status: string }) {
  if (document.status === "ARCHIVED") return "Archived";
  if (document.approvalRequests.length) return document.officialStorageLocation ? "Update pending" : "Awaiting review";
  return document.officialStorageLocation ? "Current" : "Draft";
}

function stateClass(state: string) {
  if (state === "Current") return "bg-green-50 text-green-700 border-green-200";
  if (state === "Archived") return "bg-zinc-100 text-zinc-700 border-zinc-200";
  return "bg-amber-50 text-amber-800 border-amber-200";
}

export default async function DocumentsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const search = searchParams.search?.trim();
  const teamId = searchParams.team_id;
  const visibility = searchParams.visibility;

  const access = visibleResourceWhere(user);
  const where = {
    AND: [
      access,
      { resourceType: "DOCUMENT" as const, archivedAt: null },
      ...(search ? [{ OR: [{ name: { contains: search, mode: "insensitive" as const } }, { description: { contains: search, mode: "insensitive" as const } }, { tags: { some: { name: { contains: search, mode: "insensitive" as const } } } }] }] : []),
      ...(teamId ? [{ teamId }] : []),
      ...(visibility ? [{ visibility: visibility as "TEAM_ONLY" | "ORGANIZATION" }] : [])
    ]
  };

  const [documents, teams] = await Promise.all([
    prisma.resource.findMany({
      where,
      include: {
        team: true,
        owner: true,
        tags: true,
        versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        approvalRequests: { where: { type: "RESOURCE_STORAGE", status: "PENDING" }, select: { id: true } }
      },
      orderBy: { updatedAt: "desc" }
    }),
    prisma.team.findMany({ where: { archivedAt: null }, orderBy: { name: "asc" } })
  ]);
  const current = documents.filter((document) => stateOf(document) === "Current").length;
  const awaitingReview = documents.filter((document) => document.approvalRequests.length > 0).length;

  return (
    <PageShell
      title="Documents"
      description="The latest trusted documentation from every team, with ownership and version history kept clear."
      actions={(user.role === "ADMIN" || user.role === "CONTRIBUTOR") ? <Link className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white" href="/resources/new">Upload Document</Link> : undefined}
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="surface rounded-lg p-4"><div className="muted-label">Visible documents</div><div className="mt-2 text-2xl font-bold">{documents.length}</div></div>
        <div className="surface rounded-lg p-4"><div className="muted-label">Current</div><div className="mt-2 text-2xl font-bold text-green-700">{current}</div></div>
        <div className="surface rounded-lg p-4"><div className="muted-label">Awaiting review</div><div className="mt-2 text-2xl font-bold text-amber-700">{awaitingReview}</div></div>
      </div>

      <form className="surface mb-4 grid gap-3 rounded-lg p-4 md:grid-cols-[2fr_1fr_1fr_auto]">
        <label>Search<input name="search" defaultValue={searchParams.search} placeholder="Title, description, or tag" /></label>
        <label>Team<select name="team_id" defaultValue={teamId ?? ""}><option value="">All teams</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
        <label>Access<select name="visibility" defaultValue={visibility ?? ""}><option value="">All access</option><option value="TEAM_ONLY">Team only</option><option value="ORGANIZATION">Organization</option></select></label>
        <button className="self-end rounded-md border border-line px-4 py-2 font-semibold">Filter</button>
      </form>

      <div className="surface overflow-x-auto rounded-lg">
        <table className="data-table min-w-[820px]">
          <thead><tr><th>Document</th><th>Team</th><th>Current version</th><th>Status</th><th>Access</th><th>Updated</th></tr></thead>
          <tbody>
            {documents.map((document) => {
              const state = stateOf(document);
              return <tr key={document.id}>
                <td><Link className="font-semibold hover:underline" href={`/resources/${document.id}`}>{document.name}</Link><div className="mt-1 text-xs text-slate-500">{document.tags.map((tag) => tag.name).join(", ") || "No tags"}</div></td>
                <td>{document.team.name}</td>
                <td>{document.versions[0]?.versionName ?? "-"}</td>
                <td><GenericBadge value={state} className={stateClass(state)} humanize={false} /></td>
                <td>{humanizeEnum(document.visibility)}</td>
                <td>{formatDate(document.updatedAt)}</td>
              </tr>;
            })}
            {!documents.length && <tr><td colSpan={6} className="py-10 text-center text-slate-500">No documents match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
