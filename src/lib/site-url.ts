/** The public origin (no trailing slash), from APP_URL; used for metadata, sitemap and robots. */
export function siteUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
