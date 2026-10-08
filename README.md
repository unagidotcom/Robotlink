# Article SEO Visibility Platform

Phase A establishes the secure, tenant-aware foundation. Phase B1 adds authenticated client management, content CRUD, conservative URL normalization, CSV preview/import, rejection reporting, and responsive operational views.

## Current boundaries

Included: authentication, roles, agency/client isolation, audit/status history, content and platform foundations, provider contracts, monitoring budgets, content management, and idempotent CSV imports.

Not included: paid ranking calls, technical crawling, publishing automation, promotion submissions, engagement synchronization, or revenue synchronization.

## Local setup

Requirements: Node.js 20.9+ and PostgreSQL 15+.

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Create the PostgreSQL database and a least-privilege application user.
3. Run `npm install`.
4. Run `npm run db:deploy` (or `npm run db:migrate` during schema development).
5. Set the three `BOOTSTRAP_*` variables and run `npm run bootstrap:owner` once.
6. Remove the bootstrap password from the environment.
7. Run `npm run dev`.

## Verification

```text
npm run db:validate
npm run typecheck
npm test
npm run lint
npm run build
```

Database integration tests are opt-in so they can never target a developer database accidentally:

```text
TEST_DATABASE_URL=postgresql://... RUN_DATABASE_INTEGRATION=true npm test
```

The test database must already have the current migration applied and must be disposable.

See `docs/architecture.md`, `docs/security.md`, and `docs/deployment.md` before extending the system.

Authenticated routes are `/dashboard`, `/clients`, `/content`, and `/imports`. Evidence-based statuses begin as `UNKNOWN`; content creation and import never promote them.
