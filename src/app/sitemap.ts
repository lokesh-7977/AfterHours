import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/** Public, indexable pages only. Account, admin and API routes are excluded (see robots.ts). */
export default function sitemap(): MetadataRoute.Sitemap {
  const url = siteUrl();
  return [
    { url: `${url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${url}/events`, changeFrequency: "daily", priority: 0.8 },
    { url: `${url}/register`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${url}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
