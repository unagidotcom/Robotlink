# Phase A architecture

## Boundaries

- `app/`: Next.js user interface and HTTP route handlers.
- `lib/auth/`: password hashing, opaque database sessions, request-origin checks, login throttling, and RBAC.
- `lib/tenant/`: authenticated agency context and tenant-scoped query construction.
- `platforms/`: provider-neutral platform identification and adapter contracts.
- `providers/`: ranking, engagement, and revenue contracts plus budget admission rules. No paid provider is implemented.
- `prisma/`: PostgreSQL schema and versioned migrations.

The initial deployment is a modular monolith. Future workers must import domain contracts rather than UI code.

## Platform rule

A platform's declared capability and a publisher account's permission for a specific content item are different facts. Recommendations must require both when an edit is proposed.

Instagram post and Reel URLs are identified separately. Public visibility, professional-account eligibility, Google visibility, engagement, referrals, and monetization remain separate evidence streams. Unknown values must stay Unknown.

## Tenant rule

All agency-owned records carry an agency relationship or belong to a client that does. Request code obtains agency identity from authenticated membership and appends that trusted identifier after untrusted filters. Cross-tenant misses should generally be returned as not found.

PostgreSQL row-level security may be added as defense in depth after the database role topology is finalized. Application scoping remains mandatory.

## Provider rule

Provider implementations must expose cost estimation and accept tenant, idempotency, and correlation context. A scheduler must receive budget approval before execution. An adapter should not contain business status logic; it returns evidence for the core to interpret.
