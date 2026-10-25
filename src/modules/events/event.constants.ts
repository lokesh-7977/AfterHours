/** Client-safe event enums and labels. */
export const EVENT_STATUSES = ["draft", "published", "cancelled", "completed"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_CATEGORIES = [
  "technology",
  "business",
  "music",
  "arts",
  "sports",
  "health",
  "education",
  "community",
  "food",
  "other",
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  technology: "Technology",
  business: "Business",
  music: "Music",
  arts: "Arts & Culture",
  sports: "Sports & Fitness",
  health: "Health & Wellness",
  education: "Education",
  community: "Community",
  food: "Food & Drink",
  other: "Other",
};
