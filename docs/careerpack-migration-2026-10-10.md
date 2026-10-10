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

Manual deployment workflows require GitHub Actions secrets `CONVEX_DEPLOY_KEY`
and `CLOUDFLARE_API_TOKEN`. These durable credentials still need to be installed;
the live deployment used authorized local credentials instead.
The temporary migration key expires after 24 hours; it does not affect deployed
application operation, but cannot support later deployments or backups.

PostHog receives anonymous public pageviews only, without account IDs, raw IPs,
query strings, arbitrary properties, session replay or additional browser cookies.
An anonymous test pageview sent through the live site's analytics route was
confirmed in the new PostHog project. Existing MCP clients should update their
server URL to `https://accomplished-vole-302.ap-southeast-2.convex.site/mcp`.

Validation: frontend/backend type checks, lint, 794 passing tests (one skipped),
Linux OpenNext production build, live health checks, Google login, MCP discovery,
anonymous PostHog capture, and exact backup comparison. New file uploads,
password-reset mail and third-party MCP authorization were not exercised.
