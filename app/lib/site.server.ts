export function siteOrigin(request: Request) {
  const configured = process.env.PUBLIC_SITE_URL?.trim();
  const url = new URL(configured || request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw Error("PUBLIC_SITE_URL must use HTTP or HTTPS.");
  return url.origin;
}
