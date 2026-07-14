import { Classification, ProjectCollaboratorRole, Resource, ResourceVisibility, TeamRole, UserRole } from "@prisma/client";

type UserWithTeams = {
  id: string;
  role: UserRole;
  teamMembers: { teamId: string; role?: TeamRole }[];
};

function teamIds(user: UserWithTeams) {
  return new Set(user.teamMembers.map((member) => member.teamId));
}

export function isTeamOwner(user: UserWithTeams, teamId: string) {
  return user.teamMembers.some((member) => member.teamId === teamId && member.role === TeamRole.OWNER);
}

export function canViewResource(
  user: UserWithTeams,
  resource: Pick<Resource, "classification" | "teamId"> &
    Partial<Pick<Resource, "visibility">> & {
      project?: { collaborators: { userId: string }[] } | null;
    }
) {
  if (user.role === "ADMIN") return true;
  const isTeamMember = teamIds(user).has(resource.teamId);
  if (isTeamMember) return true;
  if (resource.project?.collaborators.some((collaborator) => collaborator.userId === user.id)) return true;
  if (resource.classification === Classification.RESTRICTED) return false;
  return (
    resource.visibility === ResourceVisibility.ORGANIZATION ||
    resource.visibility === ResourceVisibility.VISITOR ||
    resource.visibility === ResourceVisibility.PUBLIC
  );
}

export function canManageResource(
  user: UserWithTeams,
  resource: Pick<Resource, "createdById" | "teamId">
) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "CONTRIBUTOR") return false;
  return resource.createdById === user.id || teamIds(user).has(resource.teamId);
}

export function canApproveTeamResource(user: UserWithTeams, resource: Pick<Resource, "teamId">) {
  return user.role === "ADMIN" || isTeamOwner(user, resource.teamId);
}

export function canChangeResourceVisibility(user: UserWithTeams, resource: Pick<Resource, "teamId">, target: ResourceVisibility) {
  if (user.role === "ADMIN") return true;
  if (!isTeamOwner(user, resource.teamId)) return false;
  return target === ResourceVisibility.TEAM_ONLY || target === ResourceVisibility.ORGANIZATION;
}

export function canRequestPublicVisibility(user: UserWithTeams, resource: Pick<Resource, "teamId">, target: ResourceVisibility) {
  if (user.role === "ADMIN") return true;
  return isTeamOwner(user, resource.teamId) && (target === ResourceVisibility.VISITOR || target === ResourceVisibility.PUBLIC);
}

export function canArchiveResource(user: Pick<UserWithTeams, "role">) {
  return user.role === "ADMIN";
}

export function canCreateResource(user: UserWithTeams) {
  return user.role === "ADMIN" || user.role === "CONTRIBUTOR";
}

export function canManageProjects(user: Pick<UserWithTeams, "role">) {
  return user.role === "ADMIN";
}

export function canViewProject(
  user: UserWithTeams,
  project: { teamId: string; leadUserId: string; collaborators?: { userId: string }[] }
) {
  if (user.role === "ADMIN") return true;
  if (teamIds(user).has(project.teamId)) return true;
  if (project.leadUserId === user.id) return true;
  return Boolean(project.collaborators?.some((collaborator) => collaborator.userId === user.id));
}

export function canContributeToProject(
  user: UserWithTeams,
  project: { teamId: string; collaborators?: { userId: string; role: ProjectCollaboratorRole }[] }
) {
  if (user.role === "ADMIN") return true;
  if (user.role !== "CONTRIBUTOR") return false;
  if (teamIds(user).has(project.teamId)) return true;
  return Boolean(project.collaborators?.some((collaborator) => collaborator.userId === user.id && collaborator.role === ProjectCollaboratorRole.CONTRIBUTOR));
}

export function canViewAuditLogs(user: UserWithTeams) {
  return user.role === "ADMIN";
}

export function canManageTeams(user: Pick<UserWithTeams, "role">) {
  return user.role === "ADMIN";
}

export function visibleResourceWhere(user: UserWithTeams) {
  if (user.role === "ADMIN") return {};
  const ids = Array.from(teamIds(user));
  return {
    OR: [
      { teamId: { in: ids } },
      { project: { collaborators: { some: { userId: user.id } } } },
      {
        AND: [
          { classification: { not: Classification.RESTRICTED } },
          { visibility: { in: [ResourceVisibility.ORGANIZATION, ResourceVisibility.VISITOR, ResourceVisibility.PUBLIC] } }
        ]
      }
    ]
  };
}

export function visibleTeamWhere(user: UserWithTeams) {
  if (user.role === "ADMIN") return { archivedAt: null };
  return {
    archivedAt: null,
    members: {
      some: {
        userId: user.id
      }
    }
  };
}
