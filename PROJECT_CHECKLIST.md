# Resource Hub Project Checklist

This is the project's living status page. Read this file first when resuming work, and update it in the same change that completes or changes a task.

**Last updated:** 2026-08-22
**Current phase:** Document-first MVP stabilization
**Overall status:** In progress — local setup and automated verification are complete; manual MVP acceptance remains
**Next action:** Run the manual contributor, team-owner, and viewer acceptance workflow

## Status Key

- `[x]` Completed and verified, or a confirmed product decision
- `[ ]` Not completed
- **In progress** means work exists but is not ready to mark complete
- **Blocked** means progress requires a decision or dependency recorded in Blockers

Do not mark an implementation task complete only because code was written. Mark it complete after the relevant automated checks and manual acceptance checks pass.

## Current Snapshot

- The product direction has changed from a broad resource-governance demo to a document-first team knowledge base.
- The document-first implementation is recorded as a validated checkpoint; manual MVP acceptance remains.
- The current UI is intended to focus on document upload, versioning, publication, visibility, and downloads.
- The generic project, taxonomy, approval, transfer, and audit data structures remain available for future expansion.
- Local dependencies were installed successfully with `npm ci` on 2026-08-21.
- `.env` is configured, Git-ignored, and contains a non-default session secret.
- The dedicated `resourcehub_app` role and `resource_hub` database are connected, migrated, and seeded.
- PostgreSQL runs in the existing `chatbot-postgres` container; Resource Hub will use a separate role and database on that server.
- Typecheck, lint, all 21 unit tests, and the production build pass as of 2026-08-22; the development server previously returned HTTP 200 for `/login`, and manual acceptance is pending.

## 1. Product Direction

- [x] Define the first release as a document-first knowledge base
- [x] Limit supported uploads to PDF, DOCX, Markdown, and text documents
- [x] Preserve stable document identity and version history
- [x] Allow one published current version
- [x] Support team-only and organization visibility
- [x] Keep future search and chatbot work out of the first release
- [x] Provide a standard project-document template for consistent updates

## 2. MVP Implementation

The following implementation is present in the current worktree but remains **in progress** until Sections 4 and 5 pass.

- [ ] Local email/password login and signed session cookies
- [ ] Admin, contributor, and viewer roles
- [ ] Team creation and membership management
- [ ] Team-owner review and publishing workflow
- [ ] Document metadata: title, description, owner, team, and tags
- [ ] PDF, DOCX, Markdown, and text uploads
- [ ] New-version upload with change summary
- [ ] Version history and one published current version
- [ ] Team-only and organization visibility controls
- [ ] Authorized file downloads
- [ ] Audit logging
- [ ] Seed data for admin, team owner, contributor, and viewer accounts
- [ ] Project-document template available from the product workflow

## 3. Local Setup

- [x] Run `npm ci`
- [x] Copy `.env.example` to `.env` and set safe local values
- [x] Make PostgreSQL available and create the local database
- [x] Run `npm run prisma:generate`
- [x] Run `npm run prisma:migrate`
- [x] Run `npm run prisma:seed`
- [x] Confirm `npm run dev` starts the application

## 4. Automated Verification

- [x] `npm run typecheck` passes
- [x] `npm run lint` passes
- [x] `npm run test` passes
- [x] `npm run build` passes

Latest checks on 2026-08-22: typecheck and lint passed, 6 test files with 21 tests passed, and the production build completed. The development server smoke check on 2026-08-21 returned HTTP 200 for `GET /login`.

## 5. Manual MVP Acceptance

- [ ] Contributor can sign in and upload each supported document type
- [ ] Uploaded document has the expected owner, team, tags, and visibility
- [ ] Team owner can review and publish the latest version as current
- [ ] Team owner can change a document from team-only to organization visibility
- [ ] Viewer can see and download an organization-visible current version
- [ ] Viewer cannot access a team-only document outside their team
- [ ] Contributor can upload a new version with a change summary
- [ ] The new version can become current while the prior version remains in history
- [ ] Unauthorized file-download attempts are rejected
- [ ] Important upload, publish, visibility, and download actions produce audit records
- [ ] Main pages work at narrow/mobile and desktop widths
- [ ] Empty, loading, validation-error, and server-error states are understandable

## 6. MVP Milestone Completion

- [x] Review the document-first implementation diff for accidental removal or stale UI
- [ ] Resolve all failures from automated and manual verification
- [ ] Recheck README setup and workflow instructions against actual behavior
- [ ] Update this checklist with the final verification date and results
- [x] Commit a validated document-first implementation checkpoint
- [ ] Commit the manually accepted document-first MVP as a coherent milestone
- [ ] Tag or otherwise record the accepted MVP revision

## 7. Production Readiness Backlog

- [ ] Decide deployment environment and hosting architecture
- [ ] Move uploaded files from local disk to durable managed storage
- [ ] Define backup and restore procedures for database and files
- [ ] Review authentication, session, password, and secret-management controls
- [ ] Add upload malware scanning and stronger file validation
- [ ] Add rate limiting and abuse protection where appropriate
- [ ] Add structured application monitoring and error reporting
- [ ] Add CI checks for typecheck, lint, tests, and production build
- [ ] Define data retention, archive, and deletion policies
- [ ] Replace documented seed passwords before any shared deployment

## 8. Future Product Backlog

- [ ] Extract text from supported document versions
- [ ] Index only published current versions
- [ ] Add full-text search
- [ ] Add vector or hybrid retrieval if evaluation shows it is useful
- [ ] Enforce user access filters during retrieval
- [ ] Add source-document and version citations to generated answers
- [ ] Add a chatbot after retrieval quality and authorization are verified
- [ ] Reassess projects, category taxonomy, and non-document resource types
- [ ] Reassess external-source registration and storage-transfer jobs
- [ ] Reassess public or visitor publishing
- [ ] Evaluate external connectors only after the document workflow is stable

## Blockers and Decisions Needed

| Item | Status | Required action |
|---|---|---|
| `npm ci` reported 13 dependency vulnerabilities | Review needed | Run `npm audit`, assess direct impact, and upgrade deliberately without using a forced automatic fix |
| Production target is undefined | Decision needed after MVP | Choose hosting, database, and file-storage approach |

## Update This File With Every Meaningful Change

When starting work:

1. Read **Current Snapshot**, **Next action**, and **Blockers and Decisions Needed**.
2. Find the task in this file. Add it before coding if it is not already tracked.
3. Set the task's note or surrounding section to **In progress** when useful.

When finishing work:

1. Run the checks appropriate to the change.
2. Mark the task `[x]` only when its acceptance criteria pass.
3. Update **Last updated**, **Overall status**, and **Next action** at the top.
4. Add follow-up work or newly discovered problems before ending the work session.
5. Update the README when setup, user workflow, scope, or architecture changed.
6. Commit this checklist in the same commit as the implementation it describes.

When a task is blocked, leave it unchecked and add a row to **Blockers and Decisions Needed** with the exact decision or dependency required.

## Session Handoff

Before stopping a work session, keep this short handoff current:

- **Last completed:** Reviewed and recorded the document-first implementation checkpoint; typecheck, lint, all 21 tests, and the production build pass as of 2026-08-22.
- **In progress:** Document-first MVP implementation and stabilization.
- **Next:** Run the manual contributor, team-owner, and viewer acceptance workflow.
- **Known blocker:** None for local startup; dependency audit findings still require review.
- **Files or areas to review next:** Contributor, team-owner, and viewer workflows; responsive and failure states.
