# Security model

## Authentication

- Passwords use salted `scrypt` and are never logged.
- Sessions use 256-bit opaque random tokens; only SHA-256 token hashes are stored.
- Cookies are HTTP-only, SameSite=Lax, path-limited, and Secure in production.
- State-changing authentication routes require the configured application Origin.
- Login failures are throttled in PostgreSQL. Production ingress must additionally rate-limit by source/network identity.
- Disabled users and ended or expired sessions are rejected.

The bootstrap command reads credentials only from environment variables. Remove the bootstrap password immediately after use.

## Authorization and tenancy

Roles are OWNER, ADMINISTRATOR, STRATEGIST, ANALYST, and VIEWER. Permissions are checked server-side. A record ID from a request is never sufficient authorization; every query must include authenticated agency scope.

## Secrets

`.env` is ignored. Deployment secrets belong in the hosting platform's secret manager. Future publisher/provider tokens must use an encrypted credential reference rather than a plaintext database field.

## Third-party URLs

Phase A does not fetch user-provided URLs. Before Phase B network inspection, implement redirect-by-redirect SSRF controls, DNS revalidation, private/reserved IP blocking, response limits, timeouts, and per-origin rate controls.

## Audit data

Audit payloads must be allowlisted and sanitized. Do not store passwords, tokens, cookies, raw authorization headers, or unrestricted third-party response bodies.
