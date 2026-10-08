# Article SEO Visibility Platform

Phase A establishes the secure foundation, B1 adds content management, B2 adds technical inspection, and Phase C adds provider-neutral keyword ranking jobs and append-only observations.

## Current boundaries

Included: authentication, roles, agency/client isolation, audit/status history, content management, idempotent CSV imports, and conservative HTTP/robots/canonical/noindex diagnostics.

Not included: paid ranking calls, indexing submissions, publishing automation, promotion submissions, engagement synchronization, or revenue synchronization. A successful inspection never establishes search-engine indexing.

## Local setup

Requirements: Node.js 20.9+ and PostgreSQL 15+.

1. Copy `.env.example` to `.env` and replace every placeholder.
2. Create the PostgreSQL database and a least-privilege application user.
3. Run `npm install`.
4. Run `npm run db:deploy` (or `npm run db:migrate` during schema development).
5. Set the three `BOOTSTRAP_*` variables and run `npm run bootstrap:owner` once.
6. Remove the bootstrap password from the environment.
7. Run `npm run dev`.
8. In a separate process, run `npm run worker:inspection` when technical jobs should be processed.
9. After creating explicit monitoring budgets and deliberately enabling a provider, run `npm run worker:ranking` separately. Paid execution defaults to disabled.

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

The web process only enqueues inspections. The worker claims jobs atomically, applies global/client/origin limits, recovers expired leases, and retries transient failures with bounded backoff. Deploy at least one worker process separately from the web process; do not expose it as a public HTTP endpoint.
