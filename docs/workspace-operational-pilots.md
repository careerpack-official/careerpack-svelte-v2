# Workspace operational pilots — 11 October 2026

Careerpack remains the canonical application and personal career preparation stays free. Organisational workspaces now have their own pages under `/dashboard/workspaces/{id}/{feature}`. Legacy query links from notifications/invitations remain valid.

## Product boundaries

- `convex/workspaces/modules/interior.ts`: studio services, clients, projects, tasks, proposal drafts, contract drafts, business documents and portfolio case studies.
- `convex/workspaces/modules/hr.ts`: vacancies and participant interview schedules.
- `modules/types.ts` and `catalog.ts`: shared field definitions, module selection and initial draft prices.
- `records.ts`: reusable membership-guarded CRUD, validation, parent relationships and recoverable archives.
- `manage.ts`: workspace name/description, draft quote, archive and owner-only restore.
- Existing programs/submissions remain the consent boundary for Careerpack participants. HR does not clone a participant account or import a private CV/profile/library automatically.

Interior flow: create client → project linked to client → tasks/documents/proposals/contracts/case studies linked to project. Text drafts can be downloaded; this release does not generate signed contracts or formatted PDF proposals.

HR flow: manager creates a vacancy → publishes it as Terbuka → invited Careerpack participant opens that vacancy's own program and explicitly submits selected notes/files → reviewer reviews only that submission → manager schedules that participant. Each vacancy creates a separate program atomically. Participants read only their own schedules; withdrawing or losing membership immediately hides linked schedules and file grants. Schedule notes are explicitly participant-visible, not confidential reviewer notes.

Studio organisation members can read organisation records; only owner/admin writes them. HR owner/admin manages vacancies and schedules, mentors review shared submissions, members see open vacancies and their own schedules. Record parent IDs, submission IDs and workspace ID must match on the server. Archived clients/projects hide descendants. Archived vacancies close/hide their programs. Restoring a vacancy preserves its prior publication status.

## Draft pricing — no billing

Initial proposals only: studio Rp249,000/month; HR business Rp499,000/month; institutions Rp399,000/month. Workspace owner/admin can edit their draft quote. These are editable pilot assumptions, not activated subscriptions or market research. No entitlements, charges, payment links or paid status are granted by this value. DOKU workspace checkout/webhooks require a separate approved billing implementation; the existing donation payment link must not be reused for a subscription.

Workspace removal is a recoverable archive. Archive blocks all existing workspace access and revokes outstanding invitations; restoring does not revive those invitation tokens. Personal Careerpack files are untouched. Current caps: 20 workspaces/account, 20 programs including vacancy programs/workspace, 100 members, 200 records/resource including archived records. Paginate before increasing caps.

## Separate product repositories

Keep improving Careerpack as the reference, and keep business/HR product repositories separate while clients decide whether to merge. Reuse shared auth, membership, forms and CRUD; customise sector modules and product navigation. Do not maintain duplicate personal data tables or copy credentials when cloning.

`careerpack-official/careerpack-hr-pilot` is a private pilot clone. Its deployment remains disabled by user decision; current user acceptance is in Careerpack. The client's existing HR repository/site belongs to another agent and must not be modified. Each later product gets its own repo, deploy configuration and secrets. For independent backends, Careerpack participant grants require a deliberately designed authenticated bridge; do not claim isolated deployments already share identities or consent automatically.

Until a shared package is justified, synchronise selected source paths through reviewed commits and CI. Preserve the destination's product mode, worker settings, environment and disabled deploy gate. Do not merge or publish client sites automatically.

## QA

Backend tests cover rename/draft price validation, owner archive/restore, revoked invite tokens, cross-workspace references, role restrictions, parent archive visibility, input validation, unpublished vacancy access, explicit Careerpack consent, participant-only schedules and withdrawal. Frontend tests cover dedicated routes and legacy links. Live desktop/tablet/mobile results and release evidence are recorded in Linear RAH-238; real second-account invite/email QA remains separately tracked in RAH-217.
