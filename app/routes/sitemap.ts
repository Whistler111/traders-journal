import { siteOrigin } from "../lib/site.server";
export function loader({ request }: { request: Request }) {
  const origin = siteOrigin(request)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/about</loc></url></urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
