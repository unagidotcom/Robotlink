# Phase B2 technical inspection

## Trust boundary

The inspector accepts only HTTP(S), rejects URL credentials and nonstandard ports, resolves every hostname and redirect, rejects any resolution set containing a non-public address, and pins a vetted address into the socket lookup. Redirects repeat the full validation. Responses use explicit connection/total timeouts, a byte ceiling, a redirect ceiling, and `Accept-Encoding: identity`. Credentials and browser cookies are never forwarded.

Robots restrictions are checked before the content request. An explicit applicable disallow is stored as restricted evidence and prevents the page request. Failure to retrieve robots.txt remains unknown and is not treated as permission or prohibition.

## Status semantics

Inspection evidence updates only `Content.technicalStatus` and `lastVerifiedAt`. Publication, indexing, visibility, promotion, and revenue fields are untouched. `NOINDEX_SIGNAL` means a current directive was observed; it is not proof of deindexing. `ACCESSIBLE` means the resource responded successfully; it is not proof of indexing.

## Operations

Run `npm run worker:inspection` in a private worker service using the same least-privilege database role as the application. Configure the `INSPECTION_*` variables documented in `.env.example`. The queue has client capacity limits, global and per-client running limits, per-origin pacing, leases, exponential retry backoff, and a dead-letter terminal state.

Evidence rows are append-only in normal application flows. Safe error categories and bounded messages are persisted; response bodies and secrets are not. The retained raw JSON contains only structured observations.
