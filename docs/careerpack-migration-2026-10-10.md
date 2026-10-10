# Careerpack migration — 2026-10-10

This document supersedes older production-target notes in this repository.

- GitHub: `careerpack-official/careerpack-svelte-v2`.
- Cloudflare account: `8c0b86359883aaeeb6fd3ff73e54ec96`; Worker `careerpack-frontend`.
- Convex destination: team `hello-79d5d`, project `main-v2`, production `accomplished-vole-302`.
- Destination API: `https://accomplished-vole-302.ap-southeast-2.convex.cloud`.
- Destination HTTP/auth: `https://accomplished-vole-302.ap-southeast-2.convex.site`.
- PostHog: US project `656108`; Worker secret `POSTHOG_PROJECT_TOKEN` contains only the project ingestion token.

Live traffic now uses the destination. The final source snapshot was taken while
source writes were paused: 60 application tables, 5,180 documents, 44 users and 12
files. Destination verification confirmed every document ID/value and file hash.
The destination is running; source `savory-oyster-802` remains paused and retained
for rollback. Do not resume both backends' scheduled jobs after cutover.

The previous Worker version is `b9fb2d00-eef2-40ca-87c9-b3c8196f2eb0`.
Rolling back requires stopping destination writes, exporting new destination data,
reconciling changes since cutover, then resuming the source and switching the
Worker. Switching the Worker alone can discard access to post-cutover changes.

Google authentication uses client `687001400346-qt2kql9o0drvirmc2sdra5st7rfnnnfb.apps.googleusercontent.com`
with callback `https://accomplished-vole-302.ap-southeast-2.convex.site/api/auth/callback/google`.
The client secret stays in Convex environment variables; never commit it.
Google login was verified through the live site using an existing migrated admin
account. The admin role was preserved and the user count remained 44.

`pnpm backend:deploy` and `pnpm backend:deploy-prod` both use the explicit,
gitignored `backend/convex-cloud/prod.env`. Copy `prod.env.example` and fill a
destination deployment key. `scripts/backup-prod.sh` defaults to this same file
and includes file storage. The legacy self-hosted target requires an explicit
`PROD_ENV_FILE` override. Smoke checks do not trigger Dokploy by default.

## Scheduled backups and local credentials

`.github/workflows/backup-prod.yml` runs daily at 21:00 UTC (04:00 WIB) and can
also be started manually. It reuses the permanent `CONVEX_DEPLOY_KEY` and
`CLOUDFLARE_API_TOKEN` repository secrets. `BACKUP_PASSPHRASE` encrypts exports
with GPG AES256 before they leave the runner. Archives include file storage;
every JSONL row is validated, and the uploaded archive is downloaded, compared
byte-for-byte, decrypted and ZIP-checked without importing into production.

The private R2 bucket `careerpack-prod-backups` is separate from the disposable
`careerpack-next-cache`. Its `daily/` prefix expires after 14 days. No public
domain or r2.dev access is enabled; no plaintext Actions artifact is uploaded.
Wrangler's 300 MiB upload ceiling requires switching to multipart S3 before
exports grow to that size. GitHub cron starts can be delayed by GitHub.

Keep an independent copy of the backup passphrase in a password manager. The
operator's local recovery copy is outside this repository, protected by an
owner-only Windows ACL; losing the passphrase makes encrypted backups unusable.
Download an archive with `wrangler r2 object get <bucket/key> --remote --file <path>`,
decrypt using `gpg --batch --pinentry-mode loopback --passphrase-file <private-file>
--output <snapshot.zip> --decrypt <snapshot.zip.gpg>`, and validate before restoring.
Restoring remains manual and requires a fresh rollback export first.

The legacy VPS backup cron could not be inspected because both SSH routes timed
out. Do not treat it as coverage for main-v2. Audit/remove it when the host is
available, retaining old rollback snapshots.

Local CLI credentials now use `careerpack-local-cli`, with no expiration and
restricted permissions for deploy, environment configuration, diagnostic
queries/logs and exporting backups. It excludes data writes/imports, pause,
impersonation and integration/billing changes. The old migration key is no longer
stored locally and expires automatically. `new-composio` remains the Actions key.

## Email delivery

Production now uses a sending-only Resend key restricted to the verified domain
`contact.careerpack.org`. Sender: `CareerPack <noreply@contact.careerpack.org>`;
reply-to: `hello@careerpack.org` (Hostinger). The migrated old sending key belonged
to a different Resend account and rejected this domain with HTTP 403. An actual
frontend password-reset request, not just a connector test, was delivered after
rotation. Passwords are entered and changed by the account owner.

Google-only accounts receive sign-in help rather than an unusable password-reset
link. The public request response remains identical for existing/missing accounts;
both email and IP rate limits stay enforced. Old Google reset links return a
readable application error and cannot add a password login to a Google account.

Production deployment workflows require GitHub Actions secrets `CONVEX_DEPLOY_KEY`
and `CLOUDFLARE_API_TOKEN`. Both repository secrets were installed on 2026-10-10.
The [Convex deployment](https://github.com/careerpack-official/careerpack-svelte-v2/actions/runs/38052102224)
and [Cloudflare deployment](https://github.com/careerpack-official/careerpack-svelte-v2/actions/runs/38052511392)
completed successfully through GitHub Actions. Convex's `new-composio` key was
recorded as used. Worker version `c5079068-d382-4ecf-acae-f3f0e915b331` serves 100%
of traffic, with build ID `dff5e73faff235a2389fcc861cb2fe1108342e35`.
The local CLI file now uses the separate permanent key described above.

Add permanent credentials at repository **Settings > Secrets and variables >
Actions > New repository secret**. Store the main-v2 production deployment key
as `CONVEX_DEPLOY_KEY` and the dedicated Cloudflare account's scoped deployment
token as `CLOUDFLARE_API_TOKEN`. These are Actions secrets, not public variables.
The Cloudflare account ID is already pinned in the workflow; Google OAuth secrets
stay in Convex, and the PostHog ingestion token stays in Worker secret storage.

Actions is enabled and both repository secrets are present. Every push to `main`
now triggers the Cloudflare release workflow, which validates and builds first,
deploys Convex functions, then publishes the frontend. Manual dispatch remains
available. The backend-only workflow remains manual; both workflows share a
production concurrency group. Cloudflare native build triggers remain disabled
because GitHub Actions owns automatic releases.
An existing `production` environment can also hold the secrets;
repository secrets work with the current workflow's environment declaration.

PostHog receives anonymous public pageviews only, without account IDs, raw IPs,
query strings, arbitrary properties, session replay or additional browser cookies.
An anonymous test pageview sent through the live site's analytics route was
confirmed in the new PostHog project. Existing MCP clients should update their
server URL to `https://accomplished-vole-302.ap-southeast-2.convex.site/mcp`.

Validation: frontend/backend type checks, lint, 794 passing tests (one skipped),
Linux OpenNext production build, live health checks, Google login, MCP discovery,
anonymous PostHog capture, and exact backup comparison. New file uploads,
password-reset mail and third-party MCP authorization were not exercised.
GitHub Actions also passed type checks, lint, coverage tests and the production
build. The OpenGraph image lint configuration is explicitly scoped to native
ImageResponse image routes so that it works consistently on Windows and Linux.
Live frontend/backend health, deployed build ID, and retained PostHog Worker
secret metadata were verified after publication.
