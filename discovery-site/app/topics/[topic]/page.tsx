import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryCard } from "@/components/story-card";
import { getStoriesForTopic, isTopic, topics } from "@/lib/content";

type TopicPageProps = { params: Promise<{ topic: string }> };

export function generateStaticParams() {
  return topics.map((topic) => ({ topic: topic.toLowerCase() }));
}

export async function generateMetadata({ params }: TopicPageProps): Promise<Metadata> {
  const value = (await params).topic;
  if (!isTopic(value)) return {};
  const topic = topics.find((item) => item.toLowerCase() === value.toLowerCase())!;
  return { title: `${topic} journeys`, description: `Independent ${topic.toLowerCase()} travel notes and practical field guides.`, alternates: { canonical: `/topics/${topic.toLowerCase()}` } };
}

export default async function TopicPage({ params }: TopicPageProps) {
  const value = (await params).topic;
  if (!isTopic(value)) notFound();
  const topic = topics.find((item) => item.toLowerCase() === value.toLowerCase())!;
  const stories = getStoriesForTopic(topic);

  return (
    <section className="shell listing-page">
      <p className="eyebrow">Field notes by terrain</p>
      <h1>{topic}</h1>
      <p className="listing-page__intro">Quiet observations and useful references for journeys shaped by {topic.toLowerCase()} landscapes.</p>
      {stories.length ? <div className="story-grid">{stories.map((story) => <StoryCard key={story.slug} story={story} />)}</div> : <p className="empty-state">No approved notes in this collection yet.</p>}
    </section>
  );
}
