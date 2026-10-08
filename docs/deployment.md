# Staging deployment and rollback

No deployment command should run until a human explicitly authorizes a Vercel deployment. The web application may run on Vercel; inspection and ranking workers must run as separate long-lived services.

## Prepared Neon staging target

- Project: `fragrant-water-92604913`
- Branch: `staging/vercel-20261008` (`br-dry-dew-b4e609t3`)
- Database: `robotlink_staging`
- Compute: `ep-cold-grass-b462qvvi`
- Expiration: 2026-11-07T00:00:00Z

The branch was created schema-only and the database separately. It contains no copied production application rows. All four migrations apply cleanly, repeat deployment reports no pending migrations, and Prisma reports no schema difference.

## Vercel Preview environment

- `DATABASE_URL`: pooled TLS URL for `robotlink_staging`.
- `APP_ORIGIN`: exact stable staging URL or protected Vercel alias.
- `SESSION_COOKIE_NAME=robotlink_staging_session`.
- `SESSION_TTL_HOURS=12`.
- `WORKERS_ENABLED=false`.
- `AUTO_INSPECT_CONFIRMED_IMPORTS=false` until an inspection worker exists.
- `DATAFORSEO_EXECUTION_ENABLED=false`.

Do not store database URLs, bootstrap passwords, DataForSEO credentials, or Neon API keys in Git. Vercel sets `NODE_ENV=production`. Worker-only tuning variables can be omitted from the web deployment.

## Release procedure

1. Keep the repository private or enable Vercel deployment protection.
2. Import `unagidotcom/Robotlink` into Vercel as a Next.js project, but do not deploy until Preview variables are configured.
3. Use `npm ci` and `npm run build`; `postinstall` regenerates Prisma Client.
4. From a trusted migration job, obtain the non-pooled staging URL without printing it and run `npm run db:deploy`. Never migrate from a request handler.
5. Create the initial staging owner once from a trusted local or CI environment using temporary `BOOTSTRAP_*` variables, then remove them immediately.
6. Deploy only the web application. Do not start `worker:inspection` or `worker:ranking` in this phase.
7. Verify `/login`, secure cookies, `/dashboard`, client isolation, a small CSV preview/import, and the queue-only banner.

Use a stable staging alias for `APP_ORIGIN`; per-commit preview URLs otherwise fail the strict origin check. Keep the Vercel function region close to Neon when project settings permit. Use Neon's pooled hostname for serverless web traffic.

## Rollback

1. Promote the previous successful Vercel deployment or use Vercel rollback.
2. Do not reverse database migrations automatically; migrations are forward-only.
3. For a data-affecting migration problem, stop writes, preserve the branch, and restore or branch from the last known-good Neon restore point after review.
4. Rotate compromised credentials in Neon and Vercel before redeployment.
5. Delete or allow expiration of the temporary branch only after confirming no staging evidence is needed.

## Monitoring before workers

Alert on authentication failures, server errors, database connection failures, upload rejection rates, and queue growth. Pending jobs are expected while `WORKERS_ENABLED=false`; the authenticated UI displays a queue-only banner. Once workers are approved, add oldest-pending-age, expired-lease, dead-letter, provider-error, and budget-block alerts.
