# Resource Hub

Resource Hub is a document-first knowledge base for teams. Each team can upload its documentation, keep a clear version history, and publish one trusted current version. The product keeps the Resource Hub name because other resource types can be added later.

The first release intentionally focuses on documents so the organization can establish reliable, up-to-date source material before adding search or a chatbot.

## Project status

Start with [`PROJECT_CHECKLIST.md`](./PROJECT_CHECKLIST.md) when beginning or resuming work. It records the current phase, the next action, verification status, blockers, and future backlog.

Update the checklist in the same change as the work it describes. A task is complete only after its relevant checks pass; also update the handoff and next action before ending a work session.

## What the MVP does

- Local email/password login
- Admin, contributor, and viewer roles
- Team creation and membership
- Team-owner review
- PDF, DOCX, Markdown, and text uploads
- Document title, description, owner, team, and tags
- Version history with a change summary
- One published current version
- Team-only or organization visibility
- Authorized downloads
- Audit logging

A contributor uploads a document or a new version. A team owner publishes the latest version as current. Previous versions remain in history. A team owner can also make the current document discoverable to everyone in the organization.

Teams should use the project document template at public/templates/project-document-template.md. Its consistent headings make progress, blockers, next steps, contributions, and missing updates easier to retrieve accurately later.

## Future chatbot foundation

The application already preserves the information retrieval will need later:

- Stable document identity
- Current versus previous versions
- Team ownership
- Access visibility
- Version change summaries
- Original files and checksums

A future phase can extract text from each uploaded version, index only current versions, filter results by the signed-in user's access, and cite the source document and version in chatbot answers.

## Technology

- Next.js 14 App Router
- React 18 and TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- bcryptjs and signed HTTP-only cookies
- Local filesystem document storage
- Zod validation
- Vitest

## Project structure

- `src/app`: pages and API route handlers
- `src/components`: document, team, navigation, and publishing UI
- `src/lib`: authentication, permissions, storage, and domain services
- `prisma/schema.prisma`: database schema
- `prisma/migrations`: PostgreSQL migrations
- `prisma/seed.ts`: initial users and team

The underlying Prisma schema retains generic resource, project, taxonomy, approval, transfer, and audit structures for future expansion. The active product experience creates and displays documents only.

## Setup

Requirements:

- A modern Node.js release
- PostgreSQL

Copy `.env.example` to `.env` and configure:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/resource_hub?schema=public"
RESOURCE_STORAGE_ROOT="./resource-hub-storage"
SESSION_SECRET="replace-with-a-long-random-secret"
MAX_UPLOAD_BYTES="104857600"
```

Install and initialize:

```bash
npm ci
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Seed accounts

```text
Admin:       admin@resourcehub.local       / admin123
Team owner:  lead@resourcehub.local        / lead123
Contributor: contributor@resourcehub.local / contributor123
Viewer:      viewer@resourcehub.local      / viewer123
```

A useful workflow test is:

1. Sign in as the contributor and upload a document.
2. Sign in as the team owner and publish it as current.
3. Change access from team-only to organization.
4. Sign in as the viewer and confirm the current version is visible and downloadable.
5. Upload another version and confirm the old version remains in history.

## Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Deferred scope

The current UI does not expose projects, category taxonomy, external-source registration, storage jobs, public/visitor publishing, or non-document resource types. External connectors, text extraction, full-text/vector search, and chatbot functionality are later phases.
