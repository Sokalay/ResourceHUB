import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { TeamArchiveButton } from "@/components/team-archive-button";
import { TeamCreateForm } from "@/components/team-create-form";
import { getCurrentUser } from "@/lib/auth";
import { visibleTeamWhere } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { humanizeEnum } from "@/lib/resource-metadata";

export default async function TeamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const teams = await prisma.team.findMany({
    where: visibleTeamWhere(user),
    include: {
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      resources: { where: { resourceType: "DOCUMENT", archivedAt: null }, select: { id: true } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <PageShell title="Teams" description="Each team owns and keeps its documentation current.">
      {user.role === "ADMIN" && <TeamCreateForm />}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {teams.map((team) => <div key={team.id} className="rounded-lg border border-line bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div><h2 className="font-bold">{team.name}</h2><p className="mt-1 text-sm text-slate-600">{team.description || "No description"}</p></div>
            <div className="flex gap-2 text-center text-xs">
              <div className="rounded-md bg-panel px-3 py-2"><div className="font-bold">{team.members.length}</div><div>Members</div></div>
              <div className="rounded-md bg-panel px-3 py-2"><div className="font-bold">{team.resources.length}</div><div>Documents</div></div>
            </div>
          </div>
          <div className="mt-4 text-sm font-semibold">Team owners</div>
          <div className="mt-2 text-sm text-slate-600">{team.members.filter((member) => member.role === "OWNER").map((member) => member.user.name).join(", ") || "No owner assigned"}</div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-panel" href={`/teams/${team.id}`}>Open team</Link>
            {user.role === "ADMIN" && <><Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-panel" href={`/teams/${team.id}#members`}>Manage members</Link><TeamArchiveButton teamId={team.id} compact /></>}
          </div>
        </div>)}
        {!teams.length && <div className="rounded-lg border border-line bg-white p-8 text-center text-slate-500 md:col-span-2">No active teams found.</div>}
      </div>
    </PageShell>
  );
}
