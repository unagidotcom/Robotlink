# Phase C ranking monitoring

Ranking targets are versioned rather than overwritten. A target combines a content URL, keyword, country, language, device, check frequency, priority, enabled state, and result depth. Historical observations remain attached to the version that produced them.

The ranking worker is separate from the web process. Jobs use PostgreSQL atomic claiming, leases, recovery, retries, dead letters, shared query keys, and conservative top-10 defaults. Identical market queries can share one public provider response while every tenant receives a separately scoped observation; private target URLs are never sent between tenants.

DataForSEO execution is disabled by default. Enabling it requires server-side credentials, an explicit execution flag, location-code mapping, agency/client budgets, and a global daily ceiling. The adapter uses Google Organic Live Advanced and does not scrape Google directly. Tests use fixtures and never make paid calls.

`RANKED` means a URL match appeared at a recorded position in one provider response at one time. `NOT_FOUND_WITHIN_DEPTH` means only that no acceptable match appeared within the checked depth. Neither state is written to indexing evidence, and neither guarantees current or future Google indexing.
