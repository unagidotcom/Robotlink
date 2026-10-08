# Phase B1 implementation

## Content management

Authenticated agency members can view the dashboard and inventory. Roles with `client:write` can create clients; roles with `content:write` can create, edit, and archive content or run imports. Every mutation rechecks the database session, agency membership, and role at the server action boundary.

URL normalization is conservative. Fragments and default ports are removed. Generic query strings remain intact. Instagram `/p/`, `/reel/`, and `/reels/` variants normalize to stable HTTPS URLs on `www.instagram.com`; query tracking parameters are removed for these content URLs.

Technical, indexing, visibility, promotion, and revenue states are never derived from content creation. They default to `UNKNOWN` and are displayed as Unknown or Not checked.

## CSV lifecycle

1. Select an agency client and a CSV file.
2. Map CSV headers to supported fields.
3. The server enforces a 5 MB and 10,000-row limit.
4. Every row is normalized and classified as valid, duplicate, or rejected.
5. The preview and row outcomes are stored in `ImportBatch` and `ImportRow`.
6. Confirmation imports only rows still classified valid.
7. Database uniqueness handles races without overwriting an existing record.
8. The file hash, mapping, agency, and client form the idempotency boundary.
9. Rejection reports escape spreadsheet formulas.

Import confirmation preserves every existing content record and its evidence/status history.

## PostgreSQL verification status

The Prisma schema validates and the migration chain is present. The current Windows environment exposes no PostgreSQL executable or service and has no Docker/Podman runtime. The real-database integration suite is included and gated behind `TEST_DATABASE_URL` plus `RUN_DATABASE_INTEGRATION=true`; it must not be described as passed until run against an isolated PostgreSQL database.
