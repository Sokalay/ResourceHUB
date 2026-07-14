import {
  Classification,
  PrismaClient,
  ResourceStatus,
  ResourceType,
  SourceKind,
  SourceProvider,
  StorageProvider,
  TeamRole,
  UserRole
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateResourceSlug } from "../src/lib/storage";

const prisma = new PrismaClient();

async function findOrCreateTeam(input: { name: string; description: string }) {
  const existing = await prisma.team.findFirst({ where: { name: input.name, archivedAt: null } });
  if (existing) return existing;
  return prisma.team.create({ data: input });
}

async function findOrCreateCategory(input: {
  name: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
}) {
  const parent = input.parentId
    ? await prisma.resourceCategory.findUnique({ where: { id: input.parentId } })
    : null;
  const level = parent ? parent.level + 1 : 1;
  const slug = generateResourceSlug(input.name);
  const existing = await prisma.resourceCategory.findFirst({
    where: {
      parentId: input.parentId ?? null,
      OR: [{ name: input.name }, { slug }]
    }
  });
  if (existing) return existing;
  return prisma.resourceCategory.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      parentId: input.parentId ?? null,
      level,
      sortOrder: input.sortOrder
    }
  });
}

async function seedCategoryTree() {
  const tree: Record<string, Record<string, string[]>> = {
    AI: {
      "Computer Vision": ["OCR", "Object Detection", "Image Classification", "Image Segmentation", "Face Recognition", "Document Understanding"],
      "Natural Language Processing": ["Named Entity Recognition", "Text Classification", "Machine Translation", "Word Segmentation", "Sentiment Analysis", "Question Answering", "Text Summarization"],
      "Speech Processing": ["Speech Recognition", "Text to Speech", "Speaker Identification"],
      "Generative AI": ["Large Language Model", "Retrieval-Augmented Generation", "Prompt Engineering", "Context Engineering", "Fine-Tuning"]
    },
    "Data Engineering": {
      "Data Pipeline": ["ETL", "ELT", "Airflow Workflow", "Batch Processing", "Streaming Pipeline"],
      "Data Warehouse": ["Star Schema", "Data Mart", "Data Lake"],
      "Data Quality": ["Cleaning", "Validation", "Deduplication", "Profiling"]
    },
    "Business Intelligence": {
      Dashboard: ["Revenue Report", "Customer Report", "KPI Monitoring", "Operational Dashboard"],
      Visualization: ["Chart", "Report", "Executive Summary"]
    },
    "Software Engineering": {
      "Backend System": ["API Service", "Authentication", "Database Service"],
      "Frontend System": ["Web Application", "UI Component", "Dashboard UI"],
      DevOps: ["Deployment", "CI/CD", "Monitoring", "Infrastructure"]
    },
    Research: {
      "Literature Review": ["Paper Summary", "Tool Comparison", "Model Comparison"],
      Experiment: ["Benchmark", "Evaluation Result", "Prototype"],
      Publication: ["Paper", "Presentation", "Technical Report"]
    },
    Security: {
      "Application Security": ["Vulnerability Testing", "Secure Coding"],
      "Data Security": ["Encryption", "Access Control", "Backup"]
    },
    Education: {
      "Course Material": ["Lecture Slide", "Assignment", "Lab Exercise", "Project Guide"],
      "Student Project": ["Source Code", "Report", "Dataset"]
    },
    Other: {
      General: ["Miscellaneous"]
    }
  };

  const byPath = new Map<string, string>();
  let domainOrder = 1;
  for (const [domainName, areas] of Object.entries(tree)) {
    const domain = await findOrCreateCategory({ name: domainName, sortOrder: domainOrder++ });
    byPath.set(domainName, domain.id);
    let areaOrder = 1;
    for (const [areaName, tasks] of Object.entries(areas)) {
      const area = await findOrCreateCategory({ name: areaName, parentId: domain.id, sortOrder: areaOrder++ });
      byPath.set(`${domainName}/${areaName}`, area.id);
      let taskOrder = 1;
      for (const taskName of tasks) {
        const task = await findOrCreateCategory({ name: taskName, parentId: area.id, sortOrder: taskOrder++ });
        byPath.set(`${domainName}/${areaName}/${taskName}`, task.id);
      }
    }
  }
  return byPath;
}

async function main() {
  const [adminHash, contributorHash, viewerHash] = await Promise.all([
    bcrypt.hash("admin123", 10),
    bcrypt.hash("contributor123", 10),
    bcrypt.hash("viewer123", 10)
  ]);

  const admin = await prisma.user.upsert({
    where: { email: "admin@resourcehub.local" },
    update: {},
    create: { name: "Admin", email: "admin@resourcehub.local", passwordHash: adminHash, role: UserRole.ADMIN }
  });
  const contributor = await prisma.user.upsert({
    where: { email: "contributor@resourcehub.local" },
    update: {},
    create: {
      name: "Contributor",
      email: "contributor@resourcehub.local",
      passwordHash: contributorHash,
      role: UserRole.CONTRIBUTOR
    }
  });
  const viewer = await prisma.user.upsert({
    where: { email: "viewer@resourcehub.local" },
    update: {},
    create: { name: "Viewer", email: "viewer@resourcehub.local", passwordHash: viewerHash, role: UserRole.VIEWER }
  });

  const khmer = await findOrCreateTeam({ name: "Khmer NLP Team", description: "Language resources and NLP models." });
  const data = await findOrCreateTeam({ name: "Data Engineering Team", description: "Pipelines, datasets, and platform assets." });
  const research = await findOrCreateTeam({ name: "Research Team", description: "Research outputs and reports." });

  await prisma.teamMember.createMany({
    data: [
      { userId: admin.id, teamId: khmer.id, role: TeamRole.OWNER },
      { userId: contributor.id, teamId: khmer.id, role: TeamRole.MEMBER },
      { userId: contributor.id, teamId: data.id, role: TeamRole.MEMBER },
      { userId: viewer.id, teamId: research.id, role: TeamRole.MEMBER }
    ],
    skipDuplicates: true
  });

  const categories = await seedCategoryTree();

  const samples = [
    {
      name: "Khmer OCR Dataset",
      slug: "khmer_ocr_dataset",
      resourceType: ResourceType.DATASET,
      classification: Classification.INTERNAL,
      teamId: khmer.id,
      primaryCategoryId: categories.get("AI/Computer Vision/OCR"),
      sourceProvider: SourceProvider.MANUAL,
      sourceKind: SourceKind.OTHER,
      storageProvider: StorageProvider.LOCAL,
      tags: ["khmer", "ocr", "training-data"]
    },
    {
      name: "Khmer NER XLM-R LoRA Model",
      slug: "khmer_ner_xlmr_lora_model",
      resourceType: ResourceType.MODEL,
      classification: Classification.CONFIDENTIAL,
      teamId: khmer.id,
      primaryCategoryId: categories.get("AI/Natural Language Processing/Named Entity Recognition"),
      sourceProvider: SourceProvider.HUGGINGFACE,
      sourceKind: SourceKind.MODEL_REPOSITORY,
      sourceUrl: "https://huggingface.co/example/khmer-ner-xlmr-lora",
      storageProvider: StorageProvider.LOCAL,
      tags: ["khmer", "ner", "model"]
    },
    {
      name: "Chart Understanding Pipeline",
      slug: "chart_understanding_pipeline",
      resourceType: ResourceType.CODE,
      classification: Classification.INTERNAL,
      teamId: data.id,
      primaryCategoryId: categories.get("Data Engineering/Data Pipeline/ETL"),
      sourceProvider: SourceProvider.GITHUB,
      sourceKind: SourceKind.REPOSITORY,
      sourceUrl: "https://github.com/example/chart-understanding-pipeline",
      storageProvider: StorageProvider.LOCAL,
      tags: ["pipeline", "charts", "etl"]
    }
  ];

  for (const sample of samples) {
    await prisma.resource.upsert({
      where: { slug: sample.slug },
      update: {},
      create: {
        ...sample,
        description: `${sample.name} seed resource.`,
        status: ResourceStatus.SUBMITTED,
        ownerUserId: contributor.id,
        createdById: admin.id,
        currentWorkingLocation: sample.sourceUrl ?? "Seeded sample, official transfer pending",
        primaryCategoryId: sample.primaryCategoryId,
        sourceProvider: sample.sourceProvider,
        sourceKind: sample.sourceKind,
        sourceUrl: sample.sourceUrl,
        storageProvider: sample.storageProvider,
        tags: {
          create: sample.tags.map((name) => ({ name }))
        }
      }
    });
  }
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
