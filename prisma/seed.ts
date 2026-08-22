import { PrismaClient, TeamRole, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [adminHash, leadHash, contributorHash, viewerHash] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("lead123", 10),
    bcrypt.hash("contributor123", 10),
    bcrypt.hash("viewer123", 10)
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@resourcehub.local" },
    update: {},
    create: { name: "Resource Hub Admin", email: "admin@resourcehub.local", passwordHash: adminHash, role: UserRole.ADMIN }
  });
  const lead = await prisma.user.upsert({
    where: { email: "lead@resourcehub.local" },
    update: {},
    create: { name: "Engineering Lead", email: "lead@resourcehub.local", passwordHash: leadHash, role: UserRole.CONTRIBUTOR }
  });
  const contributor = await prisma.user.upsert({
    where: { email: "contributor@resourcehub.local" },
    update: {},
    create: { name: "Engineering Contributor", email: "contributor@resourcehub.local", passwordHash: contributorHash, role: UserRole.CONTRIBUTOR }
  });
  const viewer = await prisma.user.upsert({
    where: { email: "viewer@resourcehub.local" },
    update: {},
    create: { name: "Organization Viewer", email: "viewer@resourcehub.local", passwordHash: viewerHash, role: UserRole.VIEWER }
  });

  let team = await prisma.team.findFirst({ where: { name: "Engineering", archivedAt: null } });
  if (!team) {
    team = await prisma.team.create({ data: { name: "Engineering", description: "Engineering team documentation." } });
  }

  await prisma.teamMember.createMany({
    data: [
      { userId: admin.id, teamId: team.id, role: TeamRole.OWNER },
      { userId: lead.id, teamId: team.id, role: TeamRole.OWNER },
      { userId: contributor.id, teamId: team.id, role: TeamRole.MEMBER },
      { userId: viewer.id, teamId: team.id, role: TeamRole.MEMBER }
    ],
    skipDuplicates: true
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
