import type { MetadataRoute } from "next";
import { getApprovedStories, topics } from "@/lib/content";
import { absoluteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/audit"), changeFrequency: "weekly", priority: 0.3 },
  ];
  const topicPages: MetadataRoute.Sitemap = topics.map((topic) => ({ url: absoluteUrl(`/topics/${topic.toLowerCase()}`), changeFrequency: "weekly", priority: 0.6 }));
  const storyPages: MetadataRoute.Sitemap = getApprovedStories().map((story) => ({ url: absoluteUrl(`/stories/${story.slug}`), lastModified: new Date(story.updatedAt ?? story.publishedAt), changeFrequency: "monthly", priority: 0.8 }));
  return [...staticPages, ...topicPages, ...storyPages];
}
