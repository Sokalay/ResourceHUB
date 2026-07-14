import {
  ApprovalStatus,
  ApprovalType,
  Classification,
  ProjectOrigin,
  ProjectOwnershipStatus,
  ProjectProvisioningStatus,
  PrismaClient,
  ResourceStatus,
  ResourceType,
  ResourceVisibility,
  SourceKind,
  SourceProvider,
  SourceType,
  StorageHandling,
  StorageProvider,
  TeamRole,
  TransferStatus,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateResourceSlug } from "../src/lib/storage";

const prisma = new PrismaClient();

async function user(input: { name: string; email: string; password: string; role: UserRole }) {
  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name, role: input.role },
    create: { name: input.name, email: input.email, passwordHash, role: input.role }
  });
}

async function team(input: { name: string; description: string }) {
  const existing = await prisma.team.findFirst({ where: { name: input.name, archivedAt: null } });
  if (existing) return existing;
  return prisma.team.create({ data: input });
}

async function category(path: string[]) {
  let parentId: string | null = null;
  for (let index = 0; index < path.length; index += 1) {
    const name = path[index];
    const slug = generateResourceSlug(name);
    const existing: { id: string } | null = await prisma.resourceCategory.findFirst({ where: { parentId, OR: [{ name }, { slug }] }, select: { id: true } });
    const current: { id: string } =
      existing ||
      (await prisma.resourceCategory.create({
        data: { name, slug, parentId, level: index + 1, sortOrder: index + 1 }
      }));
    parentId = current.id;
  }
  return parentId;
}

async function resetDemoResources(slugs: string[]) {
  const resources = await prisma.resource.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  await prisma.resource.deleteMany({ where: { id: { in: resources.map((resource) => resource.id) } } });
}

async function resetDemoProjects(slugs: string[]) {
  await prisma.project.deleteMany({ where: { slug: { in: slugs } } });
}

async function createPendingUpload(input: {
  name: string;
  slug: string;
  classification: Classification;
  resourceType: ResourceType;
  teamId: string;
  projectId?: string | null;
  contributedByTeamId?: string | null;
  memberId: string;
  categoryId: string | null;
  fileName: string;
  sourceAccessGranted?: boolean;
  tags: string[];
}) {
  const storagePath = `demo-staging/${input.slug}/v1/${input.fileName}`;
  return prisma.$transaction(async (tx) => {
    const resource = await tx.resource.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: "Demo resource submitted by a team member. The file is staged and waiting for team lead approval.",
        resourceType: input.resourceType,
        classification: input.classification,
        primaryCategoryId: input.categoryId,
        projectId: input.projectId ?? null,
        contributedByTeamId: input.contributedByTeamId ?? null,
        ownerUserId: input.memberId,
        teamId: input.teamId,
        currentWorkingLocation: "Uploaded by team member into Resource Hub staging",
        stagingStorageLocation: storagePath,
        sourceAccessGranted: input.sourceAccessGranted ?? true,
        sourceProvider: SourceProvider.DIRECT_UPLOAD,
        sourceKind: input.fileName.endsWith(".zip") ? SourceKind.ARCHIVE : SourceKind.FILE,
        storageProvider: StorageProvider.LOCAL,
        storageHandling: input.classification === Classification.RESTRICTED ? StorageHandling.RESTRICTED_LOCAL : StorageHandling.STANDARD_LOCAL,
        status: ResourceStatus.SUBMITTED,
        visibility: ResourceVisibility.TEAM_ONLY,
        createdById: input.memberId,
        tags: { create: input.tags.map((name) => ({ name })) }
      }
    });
    const version = await tx.resourceVersion.create({
      data: {
        resourceId: resource.id,
        versionNumber: 1,
        versionName: "v1",
        description: "Initial staged upload for team lead review.",
        storagePath,
        checksum: "demo-checksum-pending-upload",
        fileCount: 1,
        totalSizeBytes: 524288000,
        createdById: input.memberId
      }
    });
    await tx.resourceFile.create({
      data: {
        resourceId: resource.id,
        versionId: version.id,
        originalFileName: input.fileName,
        storedFileName: input.fileName,
        fileType: input.fileName.split(".").pop() ?? "zip",
        mimeType: "application/octet-stream",
        fileSizeBytes: 524288000,
        checksumSha256: "demo-checksum-pending-upload",
        storagePath,
        uploadedById: input.memberId
      }
    });
    await tx.transferJob.create({
      data: {
        resourceId: resource.id,
        versionId: version.id,
        sourceType: SourceType.UPLOAD,
        sourceLocation: input.fileName,
        destinationLocation: storagePath,
        status: TransferStatus.PENDING,
        createdById: input.memberId
      }
    });
    await tx.approvalRequest.create({
      data: {
        resourceId: resource.id,
        requestedById: input.memberId,
        type: ApprovalType.RESOURCE_STORAGE,
        status: ApprovalStatus.PENDING,
        note: "Team lead needs to choose storage handling and approve this staged upload."
      }
    });
    await tx.auditLog.createMany({
      data: [
        { userId: input.memberId, resourceId: resource.id, action: "RESOURCE_CREATED", details: { demo: true } },
        { userId: input.memberId, resourceId: resource.id, action: "RESOURCE_STORAGE_APPROVAL_REQUESTED", details: { demo: true, storagePath } }
      ]
    });
    return resource;
  });
}

async function createExternalPending(input: {
  name: string;
  slug: string;
  classification: Classification;
  resourceType: ResourceType;
  teamId: string;
  projectId?: string | null;
  contributedByTeamId?: string | null;
  memberId: string;
  categoryId: string | null;
  sourceUrl: string;
  sourceProvider: SourceProvider;
  sourceKind: SourceKind;
  sourceAccessGranted: boolean;
  tags: string[];
}) {
  return prisma.resource.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: "Demo external/private source submitted by a team member for review.",
      resourceType: input.resourceType,
      classification: input.classification,
      primaryCategoryId: input.categoryId,
      projectId: input.projectId ?? null,
      contributedByTeamId: input.contributedByTeamId ?? null,
      ownerUserId: input.memberId,
      teamId: input.teamId,
      currentWorkingLocation: input.sourceUrl,
      sourceUrl: input.sourceUrl,
      sourceAccessGranted: input.sourceAccessGranted,
      sourceProvider: input.sourceProvider,
      sourceKind: input.sourceKind,
      storageProvider: StorageProvider.LOCAL,
      storageHandling: input.classification === Classification.RESTRICTED ? StorageHandling.RESTRICTED_LOCAL : StorageHandling.ORGANIZATION_INTERNAL,
      status: ResourceStatus.SUBMITTED,
      visibility: ResourceVisibility.TEAM_ONLY,
      createdById: input.memberId,
      tags: { create: input.tags.map((name) => ({ name })) },
      transferJobs: {
        create: {
          sourceType: input.sourceProvider === SourceProvider.GITHUB ? SourceType.GITHUB_LINK : SourceType.GOOGLE_DRIVE_LINK,
          sourceLocation: input.sourceUrl,
          status: TransferStatus.PENDING,
          createdById: input.memberId
        }
      },
      approvalRequests: {
        create: {
          requestedById: input.memberId,
          type: ApprovalType.RESOURCE_STORAGE,
          status: ApprovalStatus.PENDING,
          note: "Team lead should verify Resource Hub service account access and choose storage handling."
        }
      },
      auditLogs: {
        create: [
          { userId: input.memberId, action: "RESOURCE_CREATED", details: { demo: true } },
          { userId: input.memberId, action: "EXTERNAL_LINK_REGISTERED", details: { demo: true, sourceUrl: input.sourceUrl } }
        ]
      }
    }
  });
}

async function createVisibilityPending(input: {
  teamId: string;
  projectId?: string | null;
  leadId: string;
  memberId: string;
  categoryId: string | null;
}) {
  return prisma.resource.create({
    data: {
      name: "Demo Approved Organization Dataset",
      slug: "demo_approved_organization_dataset",
      description: "Demo resource already approved by the team lead. Public visibility is waiting for admin approval.",
      resourceType: ResourceType.DATASET,
      classification: Classification.INTERNAL,
      primaryCategoryId: input.categoryId,
      projectId: input.projectId ?? null,
      ownerUserId: input.memberId,
      teamId: input.teamId,
      currentWorkingLocation: "Demo staged upload approved by team lead",
      stagingStorageLocation: "demo-staging/demo_approved_organization_dataset/v1/demo-approved-dataset.zip",
      officialStorageLocation: "datasets/demo_approved_organization_dataset/v1/demo-approved-dataset.zip",
      sourceAccessGranted: true,
      sourceAccessInstructions: "Resource Hub service account has read-only access to the source folder.",
      storageHandling: StorageHandling.ORGANIZATION_INTERNAL,
      storageDecisionNotes: "Approved for organization-wide internal use.",
      sourceProvider: SourceProvider.DIRECT_UPLOAD,
      sourceKind: SourceKind.ARCHIVE,
      storageProvider: StorageProvider.LOCAL,
      status: ResourceStatus.STORED,
      visibility: ResourceVisibility.ORGANIZATION,
      pendingVisibility: ResourceVisibility.PUBLIC,
      teamApprovedAt: new Date(),
      teamApprovedById: input.leadId,
      createdById: input.memberId,
      tags: { create: [{ name: "demo" }, { name: "approved" }, { name: "visibility" }] },
      approvalRequests: {
        create: {
          requestedById: input.leadId,
          type: ApprovalType.VISIBILITY_PUBLIC,
          status: ApprovalStatus.PENDING,
          requestedVisibility: ResourceVisibility.PUBLIC,
          note: "Admin should decide whether this organization dataset can become public."
        }
      },
      auditLogs: {
        create: [
          { userId: input.memberId, action: "RESOURCE_CREATED", details: { demo: true } },
          { userId: input.leadId, action: "RESOURCE_STORAGE_APPROVED", details: { demo: true, storageHandling: StorageHandling.ORGANIZATION_INTERNAL } },
          { userId: input.leadId, action: "RESOURCE_VISIBILITY_APPROVAL_REQUESTED", details: { demo: true, requestedVisibility: ResourceVisibility.PUBLIC } }
        ]
      }
    }
  });
}

async function main() {
  const [admin, lead, member, viewer, externalLead, externalMember] = await Promise.all([
    user({ name: "Demo Org Admin", email: "demo.admin@resourcehub.local", password: "demo123", role: UserRole.ADMIN }),
    user({ name: "Demo Team Lead", email: "demo.lead@resourcehub.local", password: "demo123", role: UserRole.CONTRIBUTOR }),
    user({ name: "Demo Team Member", email: "demo.member@resourcehub.local", password: "demo123", role: UserRole.CONTRIBUTOR }),
    user({ name: "Demo Viewer", email: "demo.viewer@resourcehub.local", password: "demo123", role: UserRole.VIEWER }),
    user({ name: "Demo Platform Lead", email: "demo.platform.lead@resourcehub.local", password: "demo123", role: UserRole.CONTRIBUTOR }),
    user({ name: "Demo Platform Member", email: "demo.cross@resourcehub.local", password: "demo123", role: UserRole.CONTRIBUTOR })
  ]);

  const demoTeam = await team({
    name: "Demo Resource Governance Team",
    description: "Synthetic team for demonstrating member submission, team lead approval, and admin governance."
  });
  const platformTeam = await team({
    name: "Demo Platform Support Team",
    description: "Synthetic external team used to demonstrate cross-team project contribution."
  });

  await prisma.teamMember.createMany({
    data: [
      { userId: admin.id, teamId: demoTeam.id, role: TeamRole.OWNER },
      { userId: lead.id, teamId: demoTeam.id, role: TeamRole.OWNER },
      { userId: member.id, teamId: demoTeam.id, role: TeamRole.MEMBER },
      { userId: viewer.id, teamId: demoTeam.id, role: TeamRole.MEMBER },
      { userId: externalLead.id, teamId: platformTeam.id, role: TeamRole.OWNER },
      { userId: externalMember.id, teamId: platformTeam.id, role: TeamRole.MEMBER }
    ],
    skipDuplicates: true
  });

  const [ocrCategoryId, piiCategoryId, reportCategoryId] = await Promise.all([
    category(["AI", "Computer Vision", "OCR"]),
    category(["Security", "Data Security", "Access Control"]),
    category(["Research", "Experiment", "Evaluation Result"])
  ]);

  const slugs = [
    "demo_member_staged_ocr_dataset",
    "demo_restricted_customer_extract",
    "demo_private_github_model",
    "demo_cross_team_platform_connector",
    "demo_platform_monitoring_runbook",
    "demo_approved_organization_dataset"
  ];
  await resetDemoResources(slugs);
  await resetDemoProjects(["demo_rnd_project_alpha", "demo_existing_transfer_project", "demo_platform_enablement_project"]);

  const newProject = await prisma.project.create({
    data: {
      name: "Demo R&D Project Alpha",
      slug: "demo_rnd_project_alpha",
      description: "New project created inside Resource Hub. R&D admin ownership is expected from day one.",
      origin: ProjectOrigin.NEW,
      provisioningStatus: ProjectProvisioningStatus.NOT_REQUESTED,
      ownershipStatus: ProjectOwnershipStatus.RND_ADMIN_OWNER,
      repositoryName: "demo-rnd-project-alpha",
      teamId: demoTeam.id,
      leadUserId: lead.id,
      createdById: admin.id,
      collaborators: { create: [{ userId: externalMember.id, role: "CONTRIBUTOR" }] }
    }
  });

  const existingProject = await prisma.project.create({
    data: {
      name: "Demo Existing Transfer Project",
      slug: "demo_existing_transfer_project",
      description: "Existing project that needs the current project admin to transfer access to the R&D admin account.",
      origin: ProjectOrigin.EXISTING,
      provisioningStatus: ProjectProvisioningStatus.MANUAL_REQUIRED,
      ownershipStatus: ProjectOwnershipStatus.TRANSFER_REQUIRED,
      repositoryUrl: "https://github.com/demo-org/existing-transfer-project",
      repositoryName: "existing-transfer-project",
      teamId: demoTeam.id,
      leadUserId: lead.id,
      createdById: admin.id
    }
  });

  const platformProject = await prisma.project.create({
    data: {
      name: "Demo Platform Enablement Project",
      slug: "demo_platform_enablement_project",
      description: "Platform-owned project for demonstrating that every team has its own lead, member, project, and resources.",
      origin: ProjectOrigin.NEW,
      provisioningStatus: ProjectProvisioningStatus.READY,
      ownershipStatus: ProjectOwnershipStatus.RND_ADMIN_OWNER,
      repositoryName: "demo-platform-enablement",
      teamId: platformTeam.id,
      leadUserId: externalLead.id,
      createdById: admin.id,
      collaborators: { create: [{ userId: lead.id, role: "REVIEWER" }] }
    }
  });

  await createPendingUpload({
    name: "Demo Member Staged OCR Dataset",
    slug: "demo_member_staged_ocr_dataset",
    classification: Classification.INTERNAL,
    resourceType: ResourceType.DATASET,
    teamId: demoTeam.id,
    projectId: newProject.id,
    memberId: member.id,
    categoryId: ocrCategoryId,
    fileName: "demo-ocr-dataset.zip",
    tags: ["demo", "member-submit", "staged-upload"]
  });

  await createExternalPending({
    name: "Demo Restricted Customer Extract",
    slug: "demo_restricted_customer_extract",
    classification: Classification.RESTRICTED,
    resourceType: ResourceType.DATASET,
    teamId: demoTeam.id,
    projectId: existingProject.id,
    memberId: member.id,
    categoryId: piiCategoryId,
    sourceUrl: "gdrive://shared-with-resourcehub/restricted-customer-extract",
    sourceProvider: SourceProvider.GOOGLE_DRIVE,
    sourceKind: SourceKind.FOLDER,
    sourceAccessGranted: true,
    tags: ["demo", "restricted", "service-account"]
  });

  await createExternalPending({
    name: "Demo Cross-Team Platform Connector",
    slug: "demo_cross_team_platform_connector",
    classification: Classification.INTERNAL,
    resourceType: ResourceType.CODE,
    teamId: demoTeam.id,
    projectId: newProject.id,
    contributedByTeamId: platformTeam.id,
    memberId: externalMember.id,
    categoryId: reportCategoryId,
    sourceUrl: "https://github.com/demo-org/platform-connector",
    sourceProvider: SourceProvider.GITHUB,
    sourceKind: SourceKind.REPOSITORY,
    sourceAccessGranted: true,
    tags: ["demo", "cross-team", "project"]
  });

  await createExternalPending({
    name: "Demo Platform Monitoring Runbook",
    slug: "demo_platform_monitoring_runbook",
    classification: Classification.INTERNAL,
    resourceType: ResourceType.DOCUMENT,
    teamId: platformTeam.id,
    projectId: platformProject.id,
    memberId: externalMember.id,
    categoryId: reportCategoryId,
    sourceUrl: "https://github.com/demo-org/platform-runbooks/blob/main/monitoring.md",
    sourceProvider: SourceProvider.GITHUB,
    sourceKind: SourceKind.FILE,
    sourceAccessGranted: true,
    tags: ["demo", "platform", "runbook"]
  });

  await createExternalPending({
    name: "Demo Private GitHub Model",
    slug: "demo_private_github_model",
    classification: Classification.CONFIDENTIAL,
    resourceType: ResourceType.MODEL,
    teamId: demoTeam.id,
    projectId: newProject.id,
    memberId: member.id,
    categoryId: reportCategoryId,
    sourceUrl: "https://github.com/demo-org/private-model-repo",
    sourceProvider: SourceProvider.GITHUB,
    sourceKind: SourceKind.REPOSITORY,
    sourceAccessGranted: false,
    tags: ["demo", "private-source", "needs-access"]
  });

  await createVisibilityPending({
    teamId: demoTeam.id,
    projectId: newProject.id,
    leadId: lead.id,
    memberId: member.id,
    categoryId: ocrCategoryId
  });

  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, action: "DEMO_DATA_SEEDED", details: { teamId: demoTeam.id } },
      { userId: lead.id, action: "DEMO_TEAM_READY", details: { teamId: demoTeam.id } },
      { userId: member.id, action: "DEMO_MEMBER_READY", details: { teamId: demoTeam.id } }
    ]
  });

  console.log("Demo data seeded.");
  console.log("Admin: demo.admin@resourcehub.local / demo123");
  console.log("Team lead: demo.lead@resourcehub.local / demo123");
  console.log("Team member: demo.member@resourcehub.local / demo123");
  console.log("Platform lead: demo.platform.lead@resourcehub.local / demo123");
  console.log("Platform member: demo.cross@resourcehub.local / demo123");
  console.log("Viewer: demo.viewer@resourcehub.local / demo123");
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
