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
      members: {
        include: { user: true },
        orderBy: { createdAt: "asc" },
        take: 4
      },
      _count: { select: { members: true, resources: true, projects: true } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <PageShell title="Teams">
      {user.role === "ADMIN" && <TeamCreateForm />}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {teams.map((team) => (
          <div key={team.id} className="rounded-lg border border-line bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold">{team.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{team.description || "No description"}</p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-md bg-panel px-3 py-2">
                  <div className="font-bold">{team._count.members}</div>
                  <div>Members</div>
                </div>
                <div className="rounded-md bg-panel px-3 py-2">
                  <div className="font-bold">{team._count.projects}</div>
                  <div>Projects</div>
                </div>
                <div className="rounded-md bg-panel px-3 py-2">
                  <div className="font-bold">{team._count.resources}</div>
                  <div>Resources</div>
                </div>
              </div>
            </div>
            <div className="mt-4 text-sm font-semibold">Members</div>
            <div className="mt-2 grid gap-2 text-sm">
              {team.members.map((member) => <div key={member.id}>{member.user.name} - {humanizeEnum(member.role)}</div>)}
              {!team.members.length && <div className="text-slate-500">No members.</div>}
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-panel" href={`/teams/${team.id}`}>View</Link>
              <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-panel" href={`/teams/${team.id}/presentation`}>Presentation Brief</Link>
              {user.role === "ADMIN" && (
                <>
                  <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-panel" href={`/teams/${team.id}#edit`}>Edit</Link>
                  <Link className="rounded-md border border-line px-3 py-2 text-sm font-semibold hover:bg-panel" href={`/teams/${team.id}#members`}>Members</Link>
                  <TeamArchiveButton teamId={team.id} compact />
                </>
              )}
            </div>
          </div>
        ))}
        {!teams.length && <div className="rounded-lg border border-line bg-white p-8 text-center text-slate-500 md:col-span-2">No active teams found.</div>}
      </div>
    </PageShell>
  );
}
