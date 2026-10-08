import Link from "next/link";
import { StoryCard } from "@/components/story-card";
import { getApprovedStories, topics } from "@/lib/content";

export default function HomePage() {
  const stories = getApprovedStories();
  const [lead, ...rest] = stories;

  return (
    <>
      <section className="hero shell">
        <p className="eyebrow">Journeys worth taking slowly</p>
        <h1>Travel notes with<br /><em>a sense of place.</em></h1>
        <p className="hero__intro">Original field guides, practical context and thoughtfully chosen sources for curious travellers.</p>
      </section>

      <section className="topic-strip" aria-label="Browse by topic">
        <div className="shell topic-strip__inner">
          <span>Explore</span>
          {topics.map((topic) => <Link key={topic} href={`/topics/${topic.toLowerCase()}`}>{topic}</Link>)}
        </div>
      </section>

      <section className="shell journal-section">
        <div className="section-heading"><p className="eyebrow">The latest journal</p><span>{stories.length} published notes</span></div>
        {lead && <StoryCard story={lead} featured />}
        <div className="story-grid">{rest.map((story) => <StoryCard key={story.slug} story={story} />)}</div>
      </section>
    </>
  );
}
