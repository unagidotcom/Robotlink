import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedStories, getApprovedStory } from "@/lib/content";

type StoryPageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getApprovedStories().map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: StoryPageProps): Promise<Metadata> {
  const story = getApprovedStory((await params).slug);
  if (!story) return {};
  return {
    title: story.title,
    description: story.deck,
    alternates: { canonical: `/stories/${story.slug}` },
    openGraph: { type: "article", title: story.title, description: story.deck, publishedTime: story.publishedAt },
  };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const story = getApprovedStory((await params).slug);
  if (!story) notFound();

  return (
    <article className="article shell">
      <header>
        <Link className="back-link" href={`/topics/${story.topic.toLowerCase()}`}>← {story.topic}</Link>
        <p className="eyebrow">{story.location}</p>
        <h1>{story.title}</h1>
        <p className="article__deck">{story.deck}</p>
        <div className="byline">
          <span>Atlas &amp; Footpath editorial</span>
          <time dateTime={story.publishedAt}>Published {new Date(story.publishedAt).toLocaleDateString("en", { dateStyle: "long" })}</time>
        </div>
      </header>
      <div className="article__body">
        {story.summary.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <aside className="source-note">
          <p className="eyebrow">Continue with the source</p>
          <h2>{story.sourceTitle}</h2>
          <p>Published by {story.sourcePublisher}. This external reference was reviewed and manually approved by the editorial desk.</p>
          <a href={story.sourceUrl}>Visit the original source <span aria-hidden="true">↗</span></a>
        </aside>
      </div>
    </article>
  );
}
