import { siteOrigin } from "../lib/site.server";
export function loader({ request }: { request: Request }) {
  return new Response(
    `User-agent: *\nDisallow: /api/\nSitemap: ${siteOrigin(request)}/sitemap.xml\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
}
