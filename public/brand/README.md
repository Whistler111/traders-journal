# Brand assets

- `favicon-16x16.png`: small browser/favicon fallback, original supplied artwork.
- `favicon-32x32.png`: browser favicon and small public-page brand mark, original supplied artwork.
- `/favicon.ico`: stable root URL for browsers and search crawlers; contains original 16, 32 and 48 px images. Keep this URL stable.
- `/lottie/`: decorative feedback animations; not logos or search-preview images.

These small icons are not large Open Graph cover images. No photographic or social cover artwork was supplied, so the page does not advertise an enlarged favicon as a social cover or pretend it has a 180 px Apple touch icon. A dedicated high-resolution source would be needed for those assets.

## Install icons

`install-mark.svg` is a scalable static notebook-and-pencil rendition of the existing notebook mark. `icon-192.png` and `icon-512.png` are rendered from that vector for the PWA manifest and Apple touch icon. The original supplied favicons remain unchanged. Regenerate with `node scripts/create-pwa-icons.mjs` (installed Chrome is required). These install icons are not social-preview artwork.
