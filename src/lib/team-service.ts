import { Prisma, TeamRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function normalizeTeamName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function assertActiveTeamNameAvailable(name: string, teamId?: string, tx: Prisma.TransactionClient = prisma) {
  const normalizedName = normalizeTeamName(name);
  const existing = await tx.team.findFirst({
    where: {
      name: { equals: normalizedName, mode: "insensitive" },
      archivedAt: null,
      ...(teamId ? { id: { not: teamId } } : {})
    },
    select: { id: true }
  });
  if (existing) {
    throw new Error("TEAM_NAME_EXISTS");
  }
  return normalizedName;
}

export async function assertCanRemoveMember(teamId: string, memberId: string, tx: Prisma.TransactionClient = prisma) {
  const members = await tx.teamMember.findMany({ where: { teamId } });
  const target = members.find((member) => member.id === memberId);
  if (!target) {
    throw new Error("MEMBER_NOT_FOUND");
  }
  if (!canRemoveTeamMember(members, memberId)) {
    throw new Error("LAST_OWNER");
  }
  return target;
}

export function canRemoveTeamMember(members: Array<{ id: string; role: TeamRole }>, memberId: string) {
  const target = members.find((member) => member.id === memberId);
  if (!target) return false;
  const ownerCount = members.filter((member) => member.role === TeamRole.OWNER).length;
  return !(target.role === TeamRole.OWNER && ownerCount <= 1 && members.length > 1);
}
