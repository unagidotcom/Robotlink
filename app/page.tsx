const platforms = ["Medium", "Instagram", "WordPress.com", "Blogger", "Substack", "LinkedIn", "Public PDFs", "Generic URLs"];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <p className="eyebrow">PHASE A · FOUNDATION</p>
        <h1>Article visibility, with evidence kept honest.</h1>
        <p className="lede">
          A tenant-isolated foundation for monitoring monetized content across publishing and social platforms.
        </p>
        <div className="platforms" aria-label="Supported platform adapters">
          {platforms.map((platform) => <span key={platform}>{platform}</span>)}
        </div>
        <div className="landing-actions"><Link className="button primary" href="/login">Agency sign in</Link><Link className="button secondary" href="/dashboard">Open dashboard</Link></div>
      </section>
      <section className="principles">
        <article><b>Independent signals</b><p>Publication, accessibility, indexing evidence, rankings, engagement, and revenue remain separate.</p></article>
        <article><b>Permission-aware</b><p>Platform capabilities never imply that an account can edit a specific item.</p></article>
        <article><b>Budget bounded</b><p>Future provider work must reserve cost before it can be dispatched.</p></article>
      </section>
    </main>
  );
}
import Link from "next/link";
