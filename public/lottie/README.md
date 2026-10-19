# Original journal animations

These six original vector compositions were created for Trade Notes. They use simple paths and circles, with no third-party artwork, images, fonts, or expressions. Their reproducible source is `scripts/create-feedback-art.mjs`; regenerate with `node scripts/create-feedback-art.mjs`.

Included files (each strictly under 102,400 bytes):

- `public/lottie/success.json`
- `public/lottie/profit.json`
- `public/lottie/loss.json`
- `public/lottie/milestone.json`
- `public/lottie/empty.json` (optional loop)
- `public/lottie/loading.json` (optional loop)

Each composition lasts two seconds. Loss feedback is a slow, supportive pause; success is a checkmark, profit a small upward arrow, milestone a star, empty a gently moving journal, and loading three quiet dots.
External images, fonts, and expressions are not supported. The lightweight player and JSON load
only on demand; reduced motion uses static icons without loading either. Reload after adding artwork.
