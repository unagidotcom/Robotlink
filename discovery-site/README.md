# Atlas & Footpath discovery-site prototype

This is a standalone Next.js application for a controlled editorial discovery experiment. It does not connect to Robotlink or its database.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3001` for local use.
3. Run `npm install`.
4. Run `npm run dev -- --port 3001`.
5. Open `http://localhost:3001`.

Before an approved deployment, set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS canonical origin.

## Editorial workflow

Content is deliberately file-backed in `lib/content.ts`. New records start with `editorialStatus: "DRAFT"` and no approval fields. A human editor must review the summary and source URL, then set the record to `APPROVED` with `approvedAt` and `approvedBy`. Only approved stories are returned by the public content selector, so drafts cannot enter pages, the RSS feed, sitemap or audit log.

This prototype does not include a public form or automatic ingestion endpoint. Publication remains a reviewed source-code change.

## Verification

Run:

```text
npm run typecheck
npm run lint
npm test
npm run build
```

After starting the production build, verify `/`, an approved story, `/sitemap.xml`, `/robots.txt`, `/feed.xml`, and `/audit` return successful responses. Confirm the draft slug returns 404 and no third-party URL appears in the sitemap.

## Vercel deployment (only after explicit authorization)

1. Decide the final canonical hostname before deploying. A custom domain is preferred; the stable Vercel production domain is acceptable for the prototype.
2. Create a **new Vercel project** for Atlas & Footpath. Do not reuse or connect the Robotlink Vercel project, Neon integration, or environment variables.
3. Import the repository and set **Root Directory** to `discovery-site`.
4. Confirm **Framework Preset: Next.js**, **Install Command: `npm install`**, **Build Command: `npm run build`**, and leave Output Directory on the framework default.
5. Select a Node.js version satisfying `package.json` (`>=20.9.0`).
6. In Project Settings → Environment Variables, add `NEXT_PUBLIC_SITE_URL` with the exact final HTTPS origin and no path, query or trailing content. Apply it to Preview and Production. Example shape only: `https://travel.your-owned-domain.tld`.
7. Do not add Robotlink database credentials, authentication secrets, ranking credentials, or worker configuration. This site needs no private runtime secrets.
8. Deploy to Preview and verify `/`, an approved story, `/about`, `/audit`, `/sitemap.xml`, `/robots.txt`, and `/feed.xml`. Verify the draft URL returns 404.
9. Inspect rendered canonical tags, RSS discovery link, sitemap locations and robots sitemap directive. They must all use the final value of `NEXT_PUBLIC_SITE_URL`.
10. If using a custom domain, attach it in Project Settings → Domains, complete Vercel's DNS instructions, and wait for HTTPS issuance.
11. Redeploy after any canonical-domain change. Never leave a deployment built with localhost, a preview URL, or a placeholder as its canonical origin; the production guard will reject it.
12. After editorial and endpoint sign-off, promote the verified deployment to Production.

Rollback by promoting the preceding successful Vercel deployment. Content rollback is a normal Git revert of the relevant approved editorial commit.

## Google Search Console setup

Perform this only after the production domain serves the final site over HTTPS.

1. Sign in to Google Search Console with the agency account that will remain responsible for the discovery domain.
2. Select **Add property**.
3. For an owned custom domain, choose **Domain**, enter only the domain name, and add the DNS TXT record supplied by Google. This covers protocols and subdomains and is the preferred durable setup.
4. If the site uses only a Vercel-provided hostname or DNS access is unavailable, choose **URL-prefix** and enter the exact origin including `https://` and the final `/`. Follow one of Google's offered verification methods. Do not attempt to verify third-party publishers.
5. Leave the verification record in DNS or the selected verification mechanism in place after verification.
6. Open the verified property and inspect the home page with URL Inspection. Confirm the tested URL, canonical and live response all match the final HTTPS origin.
7. Open **Sitemaps**, enter `sitemap.xml`, and submit it once.
8. Confirm Search Console reports that the sitemap can be fetched. A successful submission means receipt, not indexing.
9. Use the Page Indexing and Sitemaps reports for the discovery site's own pages. Third-party article indexing remains outside this property's authority.
10. Record the property, verification date, sitemap submission time and responsible account in the experiment audit record.

## Experiment checklist

- [ ] Controlled domain and Search Console ownership documented.
- [ ] Twenty eligible target URLs selected and baseline-inspected.
- [ ] Ten matched pairs randomized before treatment.
- [ ] Every treatment summary is original and useful to readers.
- [ ] Every source URL and relationship is manually reviewed.
- [ ] Commercial relationships use appropriate link qualification.
- [ ] Only approved discovery-site pages appear in sitemap and feed.
- [ ] No third-party target is submitted through an ownership-restricted API.
- [ ] Publication and approval timestamps are captured.
- [ ] Observation checkpoints scheduled for 24h, 72h, 7d and 14d.
- [ ] Search appearance remains distinct from confirmed indexing.
- [ ] `UNKNOWN` is retained when authoritative evidence is unavailable.
- [ ] Control URLs receive no experimental discovery action.
- [ ] Results and protocol deviations are exported after day 14.
