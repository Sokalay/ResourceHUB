import { TeamRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canRemoveTeamMember, normalizeTeamName } from "@/lib/team-service";

describe("team service helpers", () => {
  it("normalizes team names", () => {
    expect(normalizeTeamName("  Computer   Vision Team  ")).toBe("Computer Vision Team");
  });

  it("prevents removing the last owner when other members remain", () => {
    expect(
      canRemoveTeamMember(
        [
          { id: "owner", role: TeamRole.OWNER },
          { id: "member", role: TeamRole.MEMBER }
        ],
        "owner"
      )
    ).toBe(false);
  });

  it("allows removing an owner when another owner remains", () => {
    expect(
      canRemoveTeamMember(
        [
          { id: "owner_1", role: TeamRole.OWNER },
          { id: "owner_2", role: TeamRole.OWNER }
        ],
        "owner_1"
      )
    ).toBe(true);
  });
});
