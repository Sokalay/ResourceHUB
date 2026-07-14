# Resource Hub

Resource Hub is an MVP web application for governing important R&D digital resources. It is designed to show the workflow for submitting resources, reviewing source access, choosing storage handling, approving official storage, and controlling visibility inside a team or organization.

This project is currently an MVP/demo system. It tracks the workflow and decisions, but it does not yet automatically pull files from Google Drive, GitHub, Hugging Face, or cloud storage.

## Quick Summary For ChatGPT

If you want to ask ChatGPT about this project, paste this context:

```text
I am building Resource Hub, a Next.js/TypeScript/PostgreSQL/Prisma MVP for managing R&D digital resources. The app supports local login, teams, projects, cross-team project collaborators, resource submission, category taxonomy, file uploads, external source registration, approval workflow, visibility workflow, audit logs, and demo data.

Main roles:
- ADMIN: super admin/org admin. Can manage users, teams, categories, resources, public/visitor visibility approvals, audit logs, and archive/delete resources.
- CONTRIBUTOR: can submit resources. If the contributor is a team owner, they act as team lead and can approve team storage decisions and promote visibility to organization.
- VIEWER: can view resources allowed by visibility/classification.

Main workflow:
1. ADMIN creates the project in Resource Hub before resources are submitted.
2. Every project has one owning team and one project lead.
3. New projects should start with R&D admin ownership; existing projects are marked transfer-required until the current admin transfers access.
4. Cross-team members are added as project collaborators instead of changing the owning team.
5. Team member or assigned collaborator submits resource metadata and either uploads a file or registers an external source.
6. Resource starts as TEAM_ONLY visibility under the project owning team.
7. Direct uploads are staged first; staged storage is not official storage.
8. Team lead reviews classification, source access, and storage handling.
9. Team lead chooses storage handling: STANDARD_LOCAL, ORGANIZATION_INTERNAL, RESTRICTED_LOCAL, or EXTERNAL_REFERENCE_ONLY.
10. Team lead approves storage, which marks the resource as officially stored or records external-reference-only handling.
11. Team lead can change visibility from TEAM_ONLY to ORGANIZATION.
12. PUBLIC or VISITOR visibility requires ADMIN approval.
13. ADMIN can archive/delete resources and review audit logs.

Current MVP does not yet support real external pulling/downloading from Google Drive/GitHub/Hugging Face, cloud storage integration, notifications, or a full governance policy engine.
```

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- bcryptjs for password hashing
- Cookie-based local session auth
- Local filesystem storage for MVP uploads
- Vitest for unit tests

## Important Commands

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run migrations in development:

```bash
npm run prisma:migrate
```

Seed normal development data:

```bash
npm run prisma:seed
```

Seed demo workflow data:

```bash
npm run prisma:seed:demo
```

Start development server:

```bash
npm run dev
```

Run checks:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Environment Variables

Create `.env` from `.env.example` if available, then set:

- `DATABASE_URL`: PostgreSQL connection string.
- `SESSION_SECRET`: secret used to sign local session cookies.
- `RESOURCE_STORAGE_ROOT`: local file storage root. Default is `./resource-hub-storage`.
- `MAX_UPLOAD_BYTES`: upload size limit. Default is `104857600`.

## User Roles

### Admin

Admin is the organization-level authority.

Admin can:

- Create users.
- Create admin-level users.
- Manage teams.
- Add/remove team members.
- Change team roles.
- Manage categories.
- View audit logs.
- Archive/delete resources.
- Approve/reject public or visitor visibility requests.
- Override or manage organization-wide resource metadata.

### Contributor

Contributor is the normal submitting role.

Contributor can:

- Submit resources.
- Upload staged files.
- Register external sources.
- Edit resources they can manage.
- View their team resources.

If a contributor is a team owner, they also act as team lead.

### Team Lead / Team Owner

Team lead is represented by `TeamRole.OWNER`.

Team lead can:

- Review submitted team resources.
- Approve staged upload/storage.
- Add access instructions.
- Choose storage handling.
- Promote visibility from team-only to organization.
- Request admin approval for visitor/public visibility.

### Viewer

Viewer can:

- Browse resources they are allowed to see.
- View organization-visible resources when classification allows.
- View team resources if they are a member of the owning team.

Viewer cannot:

- Submit resources.
- Approve resources.
- Change visibility.
- Archive/delete resources.

## Resource Workflow

### 1. Member Submission

A team member creates a resource record from `/resources/new`.

They provide:

- Name
- Description
- Resource type
- Classification
- Category
- Tags
- Source provider/source kind
- Source URL or current working location
- Optional direct upload
- Source access confirmation

For non-admin users:

- Owner is forced to the current user.
- Team choices are limited to the user's team memberships.
- Resource visibility starts as `TEAM_ONLY`.

### 2. Staging

If a member uploads a file, the file is stored as a staged upload.

Important distinction:

- `stagingStorageLocation`: file exists in Resource Hub staging.
- `officialStorageLocation`: file is approved as the official organization-controlled copy.

A staged upload does not count as official storage.

### 3. Team Lead Review

Team lead reviews:

- Is the metadata correct?
- Is classification correct?
- Is category correct?
- Is source access granted?
- Should Resource Hub store this officially?
- What storage handling should apply?

Storage handling options:

- `STANDARD_LOCAL`: standard local Resource Hub storage.
- `ORGANIZATION_INTERNAL`: internal organization storage.
- `RESTRICTED_LOCAL`: restricted local/internal storage.
- `EXTERNAL_REFERENCE_ONLY`: keep source as official reference; do not create an internal official copy yet.

### 4. Official Storage Approval

Team lead approves storage.

After approval:

- Resource status becomes `STORED`.
- Team approval fields are recorded.
- Storage handling is recorded.
- Access instructions and decision notes can be stored.
- Official storage path is set when applicable.

### 5. Visibility Workflow

Visibility states:

- `TEAM_ONLY`: only owning team and admin can see it.
- `ORGANIZATION`: authenticated organization users can see it unless classification restricts access.
- `VISITOR`: intended visitor-level visibility, requires admin approval.
- `PUBLIC`: intended public visibility, requires admin approval.

Team lead can:

- Change `TEAM_ONLY` to `ORGANIZATION`.
- Request `VISITOR` or `PUBLIC`.

Admin can:

- Approve or reject visitor/public visibility requests.

## Classification Rules

Classifications:

- `PUBLIC`
- `INTERNAL`
- `CONFIDENTIAL`
- `RESTRICTED`

Current visibility behavior:

- Admin can view all.
- Team members can view their team resources.
- Non-team users can view organization/public/visitor resources unless classification is `RESTRICTED`.
- `RESTRICTED` resources are limited to admin and owning team members.

## Workflow State Labels

The UI derives a readable workflow label for resource state:

- `Submitted`
- `Storage approval pending`
- `Access review needed`
- `Officially stored`
- `Public approval pending`
- `Visitor approval pending`
- `Failed`
- `Archived`

These labels appear in dashboards, resource lists, team resource rows, and resource detail pages.

## Main Pages

- `/login`: user login.
- `/dashboard`: role-aware dashboard.
- `/projects`: visible project list and admin project creation.
- `/projects/[id]`: project detail, ownership/provisioning status, collaborators, and project resources.
- `/resources`: searchable/filterable resource list.
- `/resources/new`: submit resource wizard.
- `/resources/[id]`: resource detail, workflow, approvals, storage/source information, files, versions, storage jobs, audit tab for admins.
- `/resources/[id]/edit`: edit metadata.
- `/teams`: teams visible to current user.
- `/teams/[id]`: team detail, members, team resources.
- `/teams/[id]/presentation`: slide-style team resource brief for review meetings and PDF export.
- `/categories`: admin category management.
- `/transfer-jobs`: now shown in navigation as Storage Jobs; tracks MVP storage/transfer records.
- `/admin/audit-logs`: admin audit log view.

## Demo Data

Run:

```bash
npm run prisma:seed:demo
```

Demo accounts:

```text
Admin:       demo.admin@resourcehub.local / demo123
R&D lead:    demo.lead@resourcehub.local / demo123
R&D member:  demo.member@resourcehub.local / demo123
Platform lead:   demo.platform.lead@resourcehub.local / demo123
Platform member: demo.cross@resourcehub.local / demo123
Viewer:      demo.viewer@resourcehub.local / demo123
```

Demo team:

```text
Demo Resource Governance Team
Demo Platform Support Team
```

Demo projects:

```text
Demo R&D Project Alpha
Demo Existing Transfer Project
Demo Platform Enablement Project
```

Demo resources:

- `Demo Member Staged OCR Dataset`
  - Direct upload submitted by team member.
  - File is staged.
  - Waiting for team lead storage approval.

- `Demo Restricted Customer Extract`
  - Restricted Google Drive-style source.
  - Source access marked granted.
  - Waiting for restricted storage decision.

- `Demo Private GitHub Model`
  - Confidential private GitHub source.
  - Source access not granted.
  - Good example for access review.

- `Demo Cross-Team Platform Connector`
  - Submitted by the platform member.
  - Belongs to the R&D project owned by Demo Resource Governance Team.
  - Shows how outside members contribute without changing project ownership.

- `Demo Platform Monitoring Runbook`
  - Platform team resource.
  - Belongs to Demo Platform Enablement Project.
  - Shows each team has at least one project and project resource.

- `Demo Approved Organization Dataset`
  - Already approved by team lead.
  - Organization-visible.
  - Public visibility request waiting for admin approval.

## Recommended Demo Flow

1. Log in as team member:

```text
demo.member@resourcehub.local / demo123
```

Show:

- Dashboard.
- Submit resource form.
- Account-derived owner/team context.
- Source access confirmation.
- Resource is team-only and staged.

2. Log in as team lead:

```text
demo.lead@resourcehub.local / demo123
```

Show:

- Pending approvals on dashboard.
- Open `Demo Member Staged OCR Dataset`.
- Explain staging vs official storage.
- Approve storage with storage handling and notes.
- Change visibility to organization.
- Request public visibility.

3. Log in as admin:

```text
demo.admin@resourcehub.local / demo123
```

Show:

- Admin dashboard.
- Public visibility approval request.
- Approve or reject public visibility.
- Audit logs.
- Admin-only resource archive/delete boundary.

4. Log in as viewer:

```text
demo.viewer@resourcehub.local / demo123
```

Show:

- Viewer dashboard.
- Viewer can browse allowed resources.
- Viewer cannot submit or approve.

## Core Data Models

Main Prisma models:

- `User`
- `Team`
- `TeamMember`
- `Resource`
- `ResourceCategory`
- `ResourceTag`
- `ResourceVersion`
- `ResourceFile`
- `TransferJob`
- `ApprovalRequest`
- `AuditLog`

Important enums:

- `UserRole`: `ADMIN`, `CONTRIBUTOR`, `VIEWER`
- `TeamRole`: `OWNER`, `MEMBER`
- `ResourceStatus`: `DRAFT`, `SUBMITTED`, `TRANSFERRING`, `STORED`, `FAILED`, `ARCHIVED`
- `ResourceVisibility`: `TEAM_ONLY`, `ORGANIZATION`, `VISITOR`, `PUBLIC`
- `ApprovalType`: `RESOURCE_STORAGE`, `VISIBILITY_VISITOR`, `VISIBILITY_PUBLIC`
- `ApprovalStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `StorageHandling`: `STANDARD_LOCAL`, `ORGANIZATION_INTERNAL`, `RESTRICTED_LOCAL`, `EXTERNAL_REFERENCE_ONLY`

## Important Source Files

- `prisma/schema.prisma`: database schema.
- `prisma/seed.ts`: normal development seed.
- `prisma/demo-seed.ts`: demo workflow seed.
- `src/lib/auth.ts`: local cookie session auth.
- `src/lib/permissions.ts`: access-control and visibility rules.
- `src/lib/resource-service.ts`: resource creation/upload logic.
- `src/lib/approval-service.ts`: storage and visibility approval helpers.
- `src/lib/resource-query.ts`: resource filtering/list logic.
- `src/lib/resource-metadata.ts`: workflow labels, storage status, human-readable labels.
- `src/app/dashboard/page.tsx`: role-aware dashboard.
- `src/app/resources/page.tsx`: resource list/search/filter.
- `src/app/resources/[id]/page.tsx`: resource detail and workflow display.
- `src/components/resource-form.tsx`: submit resource wizard.
- `src/components/resource-approval-actions.tsx`: approval and visibility controls.

## Current MVP Supports

- Local email/password login.
- Team management.
- Admin user creation.
- Team membership and team-owner role.
- Resource submission.
- Category taxonomy.
- File upload to local staging/official storage.
- External source registration.
- Source access confirmation.
- Storage handling decision.
- Resource workflow labels.
- Team-only and organization visibility.
- Public/visitor visibility approval requests.
- Resource version records.
- File metadata and checksum records.
- Storage job records.
- Audit logs.
- Role-aware dashboards.
- Team presentation brief with workflow summary, pending reviews, sensitive resources, and print/PDF support.
- Demo data for end-to-end workflow.

## Current MVP Does Not Yet Support

- Real Google Drive pull.
- Real GitHub clone.
- Real Hugging Face sync.
- Real cloud/object storage integration.
- Notification system.
- Anonymous public access.
- Full policy engine for classification-based auto-routing.
- Full revision/request-changes loop.
- Real service-account access verification.

## Known Product Direction

Good next improvements:

- Add explicit lifecycle statuses.
- Add a `Next Action` card per resource.
- Add `Request Changes` workflow.
- Add source access verification states.
- Add policy suggestions based on classification.
- Add admin/security escalation for restricted resources.
- Add notification/email queue.
- Add connector-based pull/copy jobs for Google Drive, GitHub, Hugging Face.

## Validation Status

Recent checks have passed:

```bash
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Manual browser testing should still be done before demos because this environment could not keep a local hidden dev server alive for screenshot-based testing.
