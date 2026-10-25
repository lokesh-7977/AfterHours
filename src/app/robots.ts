import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const url = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private, per-user or operational areas: nothing useful (or safe) to index.
        disallow: ["/api/", "/admin", "/dashboard", "/my-events", "/my-passes", "/my-gallery", "/profile", "/reset-password", "/forgot-password"],
      },
    ],
    sitemap: `${url}/sitemap.xml`,
    host: url,
  };
}
