import { describe, expect, it } from "vitest";
import { canArchiveResource, canApproveTeamResource, canManageResource, canManageTeams, canViewResource, visibleTeamWhere } from "@/lib/permissions";

const teamUser = {
  id: "user_1",
  role: "CONTRIBUTOR" as const,
  teamMembers: [{ teamId: "team_1", role: "MEMBER" as const }]
};

const teamOwner = {
  id: "owner_1",
  role: "CONTRIBUTOR" as const,
  teamMembers: [{ teamId: "team_1", role: "OWNER" as const }]
};

describe("permissions", () => {
  it("allows contributors to manage resources from their team", () => {
    expect(canManageResource(teamUser, { createdById: "other", teamId: "team_1" })).toBe(true);
  });

  it("blocks viewers from restricted resources outside their teams", () => {
    expect(
      canViewResource(
        { id: "viewer", role: "VIEWER", teamMembers: [] },
        { classification: "RESTRICTED", teamId: "team_2", visibility: "PUBLIC" }
      )
    ).toBe(false);
  });

  it("hides team-only resources outside the owning team", () => {
    expect(
      canViewResource(
        { id: "viewer", role: "VIEWER", teamMembers: [] },
        { classification: "INTERNAL", teamId: "team_2", visibility: "TEAM_ONLY" }
      )
    ).toBe(false);
  });

  it("allows team owners to approve team resources", () => {
    expect(canApproveTeamResource(teamOwner, { teamId: "team_1" })).toBe(true);
    expect(canApproveTeamResource(teamUser, { teamId: "team_1" })).toBe(false);
  });

  it("only allows admins to archive resources", () => {
    expect(canArchiveResource({ role: "ADMIN" })).toBe(true);
    expect(canArchiveResource({ role: "CONTRIBUTOR" })).toBe(false);
  });

  it("allows admins to view restricted resources", () => {
    expect(
      canViewResource(
        { id: "admin", role: "ADMIN", teamMembers: [] },
        { classification: "RESTRICTED", teamId: "team_2" }
      )
    ).toBe(true);
  });

  it("only allows admins to manage teams", () => {
    expect(canManageTeams({ role: "ADMIN" })).toBe(true);
    expect(canManageTeams({ role: "CONTRIBUTOR" })).toBe(false);
  });

  it("limits non-admin team list to active memberships", () => {
    expect(visibleTeamWhere(teamUser)).toEqual({
      archivedAt: null,
      members: { some: { userId: "user_1" } }
    });
  });
});
