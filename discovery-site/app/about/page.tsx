import type { Metadata } from "next";

export const metadata: Metadata = { title: "About", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <article className="shell prose-page">
      <p className="eyebrow">Our editorial promise</p>
      <h1>A small atlas, made with care.</h1>
      <p>Atlas &amp; Footpath is a prototype travel journal built for a controlled discovery experiment. Every public note is written to help a reader understand a place before it links elsewhere.</p>
      <h2>How sources are handled</h2>
      <p>External links are selected and approved by a human editor. Drafts never appear publicly, in the RSS feed or in the sitemap. Links are contextual references—not automated submissions, paid placement claims or guarantees of search indexing.</p>
      <h2>What this site does not do</h2>
      <p>It does not import or publish Robotlink records, generate backlinks, submit third-party URLs through ownership-restricted APIs, or manufacture visits.</p>
    </article>
  );
}
