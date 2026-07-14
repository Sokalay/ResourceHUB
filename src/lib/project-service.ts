import { Prisma, ProjectOrigin, ProjectOwnershipStatus, ProjectProvisioningStatus, ProjectStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { generateResourceSlug } from "@/lib/storage";

type UserWithTeams = {
  id: string;
  role: "ADMIN" | "CONTRIBUTOR" | "VIEWER";
  teamMembers: { teamId: string }[];
};

export async function createUniqueProjectSlug(name: string) {
  const base = generateResourceSlug(name);
  let slug = base;
  let suffix = 2;
  while (await prisma.project.findUnique({ where: { slug } })) {
    slug = `${base}_${suffix}`;
    suffix += 1;
  }
  return slug;
}

export function visibleProjectWhere(user: UserWithTeams): Prisma.ProjectWhereInput {
  if (user.role === "ADMIN") return { archivedAt: null };
  const teamIds = user.teamMembers.map((member) => member.teamId);
  return {
    archivedAt: null,
    OR: [
      { teamId: { in: teamIds } },
      { leadUserId: user.id },
      { collaborators: { some: { userId: user.id } } }
    ]
  };
}

export async function createProject(input: {
  name: string;
  description?: string | null;
  origin: ProjectOrigin;
  teamId: string;
  leadUserId: string;
  repositoryUrl?: string | null;
  repositoryName?: string | null;
  provisioningStatus?: ProjectProvisioningStatus;
  ownershipStatus?: ProjectOwnershipStatus;
  collaboratorUserIds?: string[];
  createdById: string;
}) {
  const slug = await createUniqueProjectSlug(input.name);
  const project = await prisma.project.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      origin: input.origin,
      status: ProjectStatus.ACTIVE,
      teamId: input.teamId,
      leadUserId: input.leadUserId,
      repositoryUrl: input.repositoryUrl || null,
      repositoryName: input.repositoryName || null,
      provisioningStatus: input.provisioningStatus ?? (input.origin === ProjectOrigin.NEW ? ProjectProvisioningStatus.NOT_REQUESTED : ProjectProvisioningStatus.MANUAL_REQUIRED),
      ownershipStatus: input.ownershipStatus ?? (input.origin === ProjectOrigin.NEW ? ProjectOwnershipStatus.RND_ADMIN_OWNER : ProjectOwnershipStatus.TRANSFER_REQUIRED),
      createdById: input.createdById,
      collaborators: {
        create: Array.from(new Set(input.collaboratorUserIds ?? []))
          .filter((userId) => userId !== input.leadUserId)
          .map((userId) => ({ userId }))
      }
    }
  });
  await createAuditLog({
    userId: input.createdById,
    action: "PROJECT_CREATED",
    details: { projectId: project.id, teamId: project.teamId, origin: project.origin, ownershipStatus: project.ownershipStatus }
  });
  return project;
}
