# Careerpack migration — 2026-10-10

This document supersedes older production-target notes in this repository.

- GitHub: `careerpack-official/careerpack-svelte-v2`.
- Cloudflare account: `8c0b86359883aaeeb6fd3ff73e54ec96`; Worker `careerpack-frontend`.
- Convex destination: team `hello-79d5d`, project `main-v2`, production `accomplished-vole-302`.
- Destination API: `https://accomplished-vole-302.ap-southeast-2.convex.cloud`.
- Destination HTTP/auth: `https://accomplished-vole-302.ap-southeast-2.convex.site`.
- PostHog: US project `656108`; Worker secret `POSTHOG_PROJECT_TOKEN` contains only the project ingestion token.

At preparation time, live traffic still uses `savory-oyster-802`. The destination
contains an initial verified copy: 60 application tables, 5,175 documents and 12
files, with matching IDs, values and file hashes. Final cutover requires a fresh
source snapshot while source writes are paused, replacement import, verification,
then switching the Worker version. Keep the source and previous Worker version
for rollback. Do not resume both backends' scheduled jobs after cutover.

Google authentication uses client `687001400346-qt2kql9o0drvirmc2sdra5st7rfnnnfb.apps.googleusercontent.com`
with callback `https://accomplished-vole-302.ap-southeast-2.convex.site/api/auth/callback/google`.
The client secret stays in Convex environment variables; never commit it.

`pnpm backend:deploy` and `pnpm backend:deploy-prod` both use the explicit,
gitignored `backend/convex-cloud/prod.env`. Copy `prod.env.example` and fill a
destination deployment key. `scripts/backup-prod.sh` defaults to this same file
and includes file storage. The legacy self-hosted target requires an explicit
`PROD_ENV_FILE` override. Smoke checks do not trigger Dokploy by default.

Manual deployment workflows require GitHub Actions secrets `CONVEX_DEPLOY_KEY`
and `CLOUDFLARE_API_TOKEN`. Neither secret was installed during preparation.
The temporary migration key expires after 24 hours; it does not affect deployed
application operation, but cannot support later deployments or backups.

PostHog receives anonymous public pageviews only, without account IDs, raw IPs,
query strings, arbitrary properties, session replay or additional browser cookies.
