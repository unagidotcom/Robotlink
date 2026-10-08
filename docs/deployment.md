# Development and deployment

## Services

Phase A requires a Next.js service and PostgreSQL. Phase B is expected to add a separately scalable worker while retaining the same repository and domain contracts.

## Required environment

- `DATABASE_URL`: PostgreSQL connection string with TLS settings appropriate to the provider.
- `APP_ORIGIN`: exact public application origin, including scheme.
- `SESSION_COOKIE_NAME`: stable cookie name.
- `SESSION_TTL_HOURS`: 1–168 hours.
- `NODE_ENV`: `production` in production.

Bootstrap variables are temporary and should not remain in the long-lived service configuration.

## Release sequence

1. Back up the database and confirm restore readiness.
2. Build and scan the immutable artifact.
3. Run `npm run db:deploy` as a dedicated migration job.
4. Deploy the web service with health monitoring.
5. Run an authentication and tenant-isolation smoke test.

Use a dedicated migration role if the hosting provider supports it. The runtime database role should not own the database or receive unnecessary schema privileges.

## PostgreSQL

The migration chain contains the Phase A foundation followed by `prisma/migrations/20261008183000_phase_b1_content_management/migration.sql`. Local Docker is optional; this workspace did not have Docker, Podman, PostgreSQL binaries, or an accessible WSL environment when B1 was verified.

## CI gates

- dependency audit reviewed
- Prisma schema validation
- TypeScript typecheck
- unit tests
- PostgreSQL integration tests
- lint
- production build
