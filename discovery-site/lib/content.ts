export const topics = ["Coast", "Cities", "Mountains", "Rail"] as const;
export type Topic = (typeof topics)[number];
export type EditorialStatus = "DRAFT" | "APPROVED";

export type Story = Readonly<{
  slug: string;
  title: string;
  deck: string;
  summary: readonly string[];
  topic: Topic;
  location: string;
  readingMinutes: number;
  publishedAt: string;
  updatedAt?: string;
  sourceTitle: string;
  sourceUrl: string;
  sourcePublisher: string;
  editorialStatus: EditorialStatus;
  approvedAt?: string;
  approvedBy?: string;
}>;

const stories: readonly Story[] = [
  {
    slug: "quiet-railways-of-the-konkan",
    title: "Quiet railways of the Konkan coast",
    deck: "A window-seat field guide to a landscape of laterite cuttings, estuaries and monsoon-green hills.",
    summary: [
      "The Konkan Railway turns the journey between Mumbai and Mangaluru into part of the destination. Long bridges span tidal rivers while tunnels open suddenly onto coconut country and small station platforms.",
      "A daylight train is the point. North-to-south services generally place the sea beyond the western side of the carriage, but the richest views alternate as the line bends between river valleys. Reserve the seat that suits comfort first; doorways and vestibules are not safe viewing platforms.",
      "The landscape changes markedly with the season. Monsoon journeys bring waterfalls and saturated green slopes, alongside a greater chance of slower running. Winter offers clearer horizons and gentler weather. In either season, carry drinking water and food rather than depending on every smaller station to have a long halt.",
      "Build the itinerary around one continuous rail section instead of treating the line as a race between endpoints. Ratnagiri and Udupi make useful bases for longer stays, while local transport should be checked before arrival—many stations sit some distance from the town they serve.",
      "Schedules, service changes and safety notices can change. Use the railway's passenger information to confirm the train and station details shortly before departure, then leave enough margin for a journey that belongs to the landscape as much as the timetable.",
    ],
    topic: "Rail",
    location: "Western India",
    readingMinutes: 4,
    publishedAt: "2026-10-06T07:30:00+05:30",
    sourceTitle: "Konkan Railway passenger information",
    sourceUrl: "https://konkanrailway.com/",
    sourcePublisher: "Konkan Railway Corporation",
    editorialStatus: "APPROVED",
    approvedAt: "2026-10-06T06:50:00+05:30",
    approvedBy: "Editorial desk",
  },
  {
    slug: "fort-kochi-before-breakfast",
    title: "Fort Kochi before breakfast",
    deck: "An early walk through rain trees, ferry landings and streets that reveal their history without a crowd.",
    summary: [
      "At first light, Fort Kochi belongs to newspaper deliveries, fishermen and walkers. The compact peninsula rewards an unhurried route from the ferry toward the waterfront and through the old trading streets.",
      "Start near the ferry landing and follow the waterfront before the heat gathers. The shore is a working edge rather than a staged attraction, so give fishing activity room and keep clear of ropes, nets and wet stone. From there, turn inland toward the shaded streets around the old parade ground.",
      "The area's layers are close together but deserve time: warehouses, churches, courtyard houses and later civic buildings tell different parts of the port's story. Reading a little history beforehand makes the walk more coherent than attempting to tick off isolated monuments.",
      "Dress for humidity, carry water and choose comfortable footwear for uneven pavements. Museums and heritage buildings keep different opening days, and the ferry timetable can shape the return journey. Confirm both before setting out rather than relying on a saved itinerary.",
      "A considerate visit also means using local cafés and guides without turning residential lanes into photo sets. Kerala Tourism's destination guide offers a practical overview; individual venues should still be checked directly for current access and hours.",
    ],
    topic: "Cities",
    location: "Kerala, India",
    readingMinutes: 3,
    publishedAt: "2026-10-07T08:15:00+05:30",
    sourceTitle: "Fort Kochi destination guide",
    sourceUrl: "https://www.keralatourism.org/destination/fort-kochi/422/",
    sourcePublisher: "Kerala Tourism",
    editorialStatus: "APPROVED",
    approvedAt: "2026-10-07T07:35:00+05:30",
    approvedBy: "Editorial desk",
  },
  {
    slug: "walking-the-nilgiri-edge",
    title: "Walking the Nilgiri edge with care",
    deck: "How to read the weather, respect protected landscapes and plan a gentler high-country visit.",
    summary: [
      "The Nilgiris are not a single viewpoint but a living upland of shola forest, grassland, farms and towns. A good trip leaves room for mist, local guidance and changing access rules.",
      "Elevation changes quickly here. A warm town morning can become a cold, wet ridge walk, so carry a light waterproof layer and enough water even on a short outing. Mist can erase familiar landmarks; turning back early is better judgment than pressing on without visibility.",
      "Many inviting slopes are forest, reserve land or private farmland—not open walking country. Use established public routes, obey closures and arrange a recognized local guide where access requires one. Do not approach wildlife, play calls, feed animals or leave food waste beside the road.",
      "Base the day around one area rather than driving between distant viewpoints. Walking a town market, garden or permitted forest edge reveals more than a checklist of overlooks, and it reduces traffic pressure on narrow mountain roads. Public transport or a locally hired vehicle can also remove the strain of parking at busy stops.",
      "Conditions and permissions are not static, particularly during heavy rain, fire risk or wildlife movement. Check district information and local notices shortly before travel, and treat any social-media route description as secondary to current on-the-ground guidance.",
    ],
    topic: "Mountains",
    location: "Tamil Nadu, India",
    readingMinutes: 5,
    publishedAt: "2026-10-08T09:00:00+05:30",
    sourceTitle: "The Nilgiris district visitor information",
    sourceUrl: "https://nilgiris.nic.in/tourism/",
    sourcePublisher: "Nilgiris District Administration",
    editorialStatus: "APPROVED",
    approvedAt: "2026-10-08T08:10:00+05:30",
    approvedBy: "Editorial desk",
  },
  {
    slug: "draft-goa-estuary-notes",
    title: "Estuary notes from Goa",
    deck: "A draft field note awaiting editorial review.",
    summary: ["This draft is deliberately excluded from every public route, feed and sitemap."],
    topic: "Coast",
    location: "Goa, India",
    readingMinutes: 3,
    publishedAt: "2026-10-09T10:00:00+05:30",
    sourceTitle: "Goa Tourism",
    sourceUrl: "https://goa-tourism.com/",
    sourcePublisher: "Goa Tourism",
    editorialStatus: "DRAFT",
  },
];

export function getApprovedStories(): readonly Story[] {
  return stories
    .filter((story) => story.editorialStatus === "APPROVED")
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function getApprovedStory(slug: string): Story | undefined {
  return getApprovedStories().find((story) => story.slug === slug);
}

export function getStoriesForTopic(topic: Topic): readonly Story[] {
  return getApprovedStories().filter((story) => story.topic === topic);
}

export function isTopic(value: string): value is Topic {
  return topics.some((topic) => topic.toLowerCase() === value.toLowerCase());
}
