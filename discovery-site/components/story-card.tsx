import Link from "next/link";
import type { Story } from "@/lib/content";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function StoryCard({ story, featured = false }: { story: Story; featured?: boolean }) {
  return (
    <article className={featured ? "story-card story-card--featured" : "story-card"}>
      <div className="story-card__meta">
        <span>{story.topic}</span>
        <span>{story.location}</span>
      </div>
      <h2><Link href={`/stories/${story.slug}`}>{story.title}</Link></h2>
      <p>{story.deck}</p>
      <div className="story-card__foot">
        <time dateTime={story.publishedAt}>{dateFormatter.format(new Date(story.publishedAt))}</time>
        <span>{story.readingMinutes} min read</span>
      </div>
    </article>
  );
}
