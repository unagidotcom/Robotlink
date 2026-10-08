import Link from "next/link";
import { topics } from "@/lib/content";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Atlas and Footpath home">
        <span className="brand__mark">A/F</span>
        <span>Atlas &amp; Footpath</span>
      </Link>
      <nav aria-label="Primary navigation">
        {topics.map((topic) => (
          <Link key={topic} href={`/topics/${topic.toLowerCase()}`}>{topic}</Link>
        ))}
        <Link href="/about">About</Link>
      </nav>
    </header>
  );
}
