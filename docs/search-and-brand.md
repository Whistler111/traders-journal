# Public search and brand setup

The original favicon artwork is registered globally in `app/root.tsx`. `/favicon.ico` remains a stable root asset with its original 16/32/48 px frames. PNG variants are organized under `/brand/`; `/lottie/` remains decorative animation artwork. The small icons are not advertised as large social images or Apple touch icons. Supply a higher-resolution brand source before creating those variants.

`/about` is a public, server-rendered information page with a description, canonical URL, Open Graph text and WebApplication JSON-LD. Login and private workspace URLs are marked `noindex, nofollow`; Firebase Auth and Firestore rules remain the actual access controls. No trade, reflection, account identifier or screenshot is used in public metadata.

`/sitemap.xml` lists only `/about`. `/robots.txt` allows crawling so robots can read page-level noindex directives, and excludes resource endpoints under `/api/`. Robots directives are not security controls.

Set optional server environment variable `PUBLIC_SITE_URL` to the exact production origin for stable canonical/sitemap URLs. Otherwise the request origin is used, which also supports local previews. After deployment, verify the domain in Google Search Console, submit `/sitemap.xml` and inspect `/about` and the favicon URL. No domain or Search Console verification was invented or performed locally.

Important limitation: the root `/` remains the existing protected dashboard. [Google's site-name guidance](https://developers.google.com/search/docs/appearance/site-names) expects crawlable home-page content and home-page WebSite markup; `/about` is not a substitute for that hostname-level requirement. This delivery deliberately does not move the user's dashboard or expose it for indexing. A future dedicated public root with the dashboard at `/overview` would be the appropriate next step for stronger site-name discovery, if desired.

[Google's favicon guidance](https://developers.google.com/search/docs/appearance/favicon-in-search) requires a stable, crawlable icon and home page, recommends a higher-resolution square icon, and does not guarantee search display. The supplied 48 px ICO is used without pretending that a tiny PNG is high-resolution artwork. Live Google indexing, logo selection and social-network previews cannot be confirmed by a local build.
