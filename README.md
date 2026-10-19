# Trade Notes

A trading journal ported from the supplied Trade Notes reference into the existing **React 19, React Router 8, TypeScript, Tailwind 4, Vite, and npm** project. Firebase Authentication protects the workspace and Cloud Firestore stores each account's journal. The Node server supplies the optional price proxy. No broker is automatically connected.

## Run locally

Use Node.js 24 (the build-time artwork validator uses native TypeScript stripping).

```powershell
npm.cmd install
npm.cmd run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd start
```

The production server normally uses `http://localhost:3000`. Set `PORT` to change it.

## Views and workflow

- `/about`: public application information, canonical metadata and WebApplication structured data. See [search and brand setup](docs/search-and-brand.md); private pages remain noindex. Supplied favicon PNGs live in `public/brand/`, with the stable ICO at `public/favicon.ico`.
- The dashboard has a visible sign-out button at the bottom, in addition to Account & connections and Manage data.
- [Trader sentiment and usability research](docs/trader-sentiment-ui-research.md) separates sourced findings from proposed fields and implementation priorities.

- `/login`: Google or email/password sign-in, account creation with email verification, and password reset. Protected routes wait for Firebase Auth before rendering. The reusable hero timing is in `STORY` in `app/components/auth/useChartAnimation.ts`. The prototype file was unavailable; the hero follows the supplied specification.

- `/` and `/overview`: four performance statistics and cumulative realized P&L.
- `/journal`: create, view/edit, reopen/close, delete, search, and outcome filtering.
- `/review`: grouped analysis by setup/session/plan adherence, total realized R, and 30/50-trade review progress.
- `/review` also contains playbooks, daily reflections, and grouping by playbook or mistake tag.
- `/connections`: account, email verification, device import, sign-out and broker connection guidance; reachable from Manage data.
- Original `/#overview`, `/#journal`, and `/#review` links redirect through React Router.
- Manage data provides JSON backup, confirmed replacement restore, and CSV export.

The trade form uses plain-language prompts, examples, and Buy (Long) / Sell (Short) choices. Optional exit price and position size remain visible. Closed trades show profit/loss with examples. Risk/date/context stay in Advanced, which opens automatically when required inputs are invalid. Optional position size requires an amount and units (for example `0.01 lot` or `10 shares`). Initial stop and initial cash risk remain the original values, independent of closing a trade or moving a trailing stop. The dashboard retains Avg realized R; planned reward:risk cannot be calculated without target-price data.

## Trade screenshots

Add up to **3 PNG, JPG, or WebP images per trade**, up to **10 MB per selected file**. New images are converted to **WebP**, resized to a maximum **1600-pixel edge**, and compressed to at most **500 KB** each. Existing PNG/JPEG screenshots remain supported. Preview, enlarge, and remove images in the trade form. The journal shows each trade's screenshot count.

Paste a copied image with **Ctrl+V / ⌘V** inside the trade dialog, or use **Paste image**. Ordinary text paste is unchanged. On secure origins where `navigator.clipboard.read()` is available, opening the dialog or returning focus can show an Attach/Dismiss offer. Permission denial and unsupported automatic reads are silent; paste events and file selection remain available. Clipboard reads occur only while this focused trade dialog is open and visible, never elsewhere or in a background watcher. A size/type/first-bytes fingerprint suppresses repeated offers for the same image for the browser session; dismissed offers stay dismissed. Only fingerprints, never clipboard image contents, are stored in sessionStorage for deduplication. This is optional clipboard metadata, not authentication or journal persistence.

Image files are saved as immutable, owner-only Firestore documents at `users/{uid}/images/{imageId}`. Each compressed data URL stays below Firestore's document-size limit; the supplied index exemption avoids indexing image payloads. Legacy IndexedDB (`trade-notes-images-v1`) is read only during explicit device import. Trade records contain only optional `screenshots` references (`id` and `name`), keeping image data out of trade documents. Existing device records are migrated only through explicit import. Images are staged before the financial record is committed; a failed save keeps the form contents. Failed restores leave the previous records and images intact. A missing image is reported instead of silently excluded from a backup.

**Download backup includes screenshots.** The JSON envelope remains version 1, with an optional top-level `screenshots` image payload. Old version-1 backups without images still restore. Restore validates the entire package and creates fresh image IDs before replacing records. The original vanilla reference can read the financial records, but has no screenshot support; use this React app for image backup/restore. CSV exports financial records and notes, not image files. Restore accepts JSON files up to 50 MB.

Screenshots upload when you save a trade and are available on your other signed-in devices. A failed or uncertain cloud write retains staged images rather than risking deletion of an acknowledged record's artwork. Unreferenced staged files may remain after failed operations. Download a full JSON backup for an independent copy.

## Data compatibility and safety

JSON backups retain the exact **`{version: 1, trades: [...]}`** envelope. **`trade-notes-v1`** is now a legacy device-import key, not the active trade database. Trade fields are stored at `users/{uid}/trades/{tradeId}` with `createdAt` and `updatedAt` server timestamps. Backups use version 1 and may include `exportedAt`. Original IDs, unknown trade fields, and notes are retained when editing. Exit price and size use the reference's `[Trade details]` block inside `lesson`; no new financial fields are persisted, and notes never drive calculations.

Nothing is seeded. `tests/sample-backup.FICTIONAL.json` contains invented data used only by automated tests. The supplied source is retained locally in the ignored `.reference/` directory for inspection; the application does not load its scripts.

Saving updates the interface only after screenshot uploads (when applicable) and the Firestore transaction both succeed. Duplicate submissions are guarded and controls are disabled while images are processed or saved. Storage errors retain the form. Unreadable cloud records block ordinary writes rather than being silently discarded. Backups are fully validated before replacement. Transactions compare a shared account revision and refuse stale-device overwrites; reload to review newer records. Theme, account-scoped alert preferences/delivery history, and optional milestone feedback may remain on-device, but no application-auth flag or active trade database is kept in sessionStorage/localStorage.

### Existing device journal

On sign-in, the workspace detects the `trade-notes-v1` key in localStorage and sessionStorage and offers **Import trades from this device**. It never imports automatically. The import validates both sources, merges matching IDs only when identical, includes legacy screenshots/playbooks/reflections, and records a content fingerprint under the account in the same transaction. Conflicting or malformed records leave both copies untouched. Only the unchanged local values are removed after successful server acknowledgement. Repeated imports of an already completed package do not overwrite later cloud edits. Legacy image files remain available as a recovery copy. Make a JSON backup before moving a journal between accounts.

Writes are atomic and bounded to **400 changed/deleted trades and 7 MB of changed trade JSON per operation**. Larger CSV selections should be imported in batches; oversized backup replacements/device imports are refused without partial trade writes. Firestore also limits each document to 1 MiB: keep the practice collection within that limit. Cloud writes require a network connection. Data loads from the server on entering/reloading the workspace; simultaneous edits are rejected by revision, not silently merged.

## Playbooks, mistake tags, and daily reflections

Create a playbook in Review with a name, description and up to 20 rules. Attach it in the trade form's Advanced section and check the rules followed. Each trade saves its own checklist snapshot: later edits or archiving the playbook never rewrite that trade's original rules. Archived playbooks stay available on already linked trades. Mistake tags are optional, comma-separated, case-insensitively deduplicated, with a limit of 12 tags of 40 characters each. Search and filter tags in Journal; compare playbooks or mistakes in Review. A trade with multiple tags appears in each relevant group, so those group counts must not be added together.

Daily reflections hold a focus, what worked, and one adjustment for a chosen date. Existing dates can be reopened and edited. There is no seeded trading plan or reflection. Playbooks/reflections use an additive optional `practice` property in the existing version-1 envelope; optional per-trade `journalReview` stores checklist snapshots/tags. Financial calculations remain unchanged. The Firestore transaction covers trades and practice together. Practice lives in `users/{uid}/settings/journal`. JSON backups include both. Old backups without `practice` preserve the device's existing practice data on restore; a backup with an explicitly empty practice collection clears it.

## CSV import

Choose **Manage data → Import CSV**. Select a file (up to 2 MB / 5,000 rows), source IANA timezone, date order and column mapping. Confirm that all cash amounts are USD. A preview shows selected records, flagged duplicates and row-specific errors; nothing is saved until Import is pressed. Cancel leaves the journal untouched. Import appends in one atomic write and refuses stale-tab overwrites.

The blank template includes `date,symbol,direction,entry,stop,risk,status,pnl,reason,currency,sourceId`. Essential fields are the trade date/time, symbol, Buy/Long or Sell/Short, entry, original stop, initial cash risk, explicit open/closed status and entry reason. Closed trades need broker-reported net USD P&L after fees; `0` is valid, blank is not. Open trades must leave P&L blank. Optional `setup,session,emotion,followed,lesson` are supported. Numeric values must use a decimal point without thousands separators or currency symbols. The existing CSV export can be imported, including its protected negative numbers. Images and practice data require JSON backup instead.

Dates accept ISO `YYYY-MM-DD HH:mm[:ss]` or explicit DD/MM/YYYY / MM/DD/YYYY selection. ISO UTC offsets override the selected timezone. Nonexistent or ambiguous daylight-saving wall times are rejected; supply an explicit offset to resolve them. Import provenance retains the UTC instant, source timezone and optional trade/position ID; the legacy date still displays in the current browser's local time.

Matching source IDs and identical financial records are excluded by default, including repeats within the file. Identical-looking fills can be separate real trades: they can only be included by explicitly enabling flagged duplicates and accepting an additional confirmation. Use unique broker trade/position IDs and review them carefully. Raw TradingView order history is **not** automatically reconstructed into completed positions: unfilled orders, partial fills, reversals, fees and missing risk/reasons require reconciliation. No stop, risk, reason or realized result is invented to force an import through.

## Appearance

The header appearance button cycles **System → Light → Dark**. System follows the device's color scheme; an explicit choice survives reload under `trade-notes-theme-v1`. A small pre-hydration script applies it before paint. Native controls, charts, dialogs, screenshots, menus and feedback use matching colors. Shareable PNG cards retain a light background for readability outside the app.

## Firebase setup and hosting

The app uses the modular **Firebase client SDK only**; no Admin SDK or service-account keys. Firebase initialization is lazy and SSR-safe, guarded against duplicate app/auth initialization during hot reload. Firebase manages the real auth session in IndexedDB when supported (memory fallback); the application does not invent a local login flag. Firestore uses its default memory cache, not a durable device trade cache. Route guards improve the UI; **published Firestore rules enforce data access**.

Public web-app configuration is read from these exact `.env.local` names, also listed in `.env.example`:

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
```

This is a Vite app; `vite.config.ts` explicitly exposes the `NEXT_PUBLIC_FIREBASE_` prefix to support the supplied names. No other `NEXT_PUBLIC_` variables are exposed. Configure all six on the host **before building**, then rebuild/redeploy when values change. These are Firebase's public web-app identifiers, not server credentials. Do not put service-account secrets in them. Local `.env.local` stays ignored and was not overwritten.

In the Firebase Console:

1. Register/select a Web app and copy its configuration to the variables above.
2. Enable **Authentication / Sign-in method / Email/Password and Google**, selecting the Google support email.
3. Add `localhost` and each exact production hostname under **Authentication / Settings / Authorized domains**. Configure verification/reset email templates and authorized action-link domains as needed.
4. Create a **Cloud Firestore** database in the intended region, using production mode. Publish the contents of `firestore.rules` in its Rules tab. Access is limited to authenticated owners at `users/{uid}/**`; other paths are denied.
5. Apply the field exemptions in `firestore.indexes.json` (especially image `dataUrl`), through Firestore's Indexes UI or the Firebase CLI. An authenticated CLI deployment can use `firebase deploy --only firestore --project YOUR_PROJECT_ID`; it does not require giving this app a service-account key.
6. For Google redirect fallback on browsers blocking third-party storage, follow [Firebase's redirect hosting guidance](https://firebase.google.com/docs/auth/web/redirect-best-practices): use a suitable same-site auth domain/Hosting configuration or supported auth-helper proxy. Authorizing a domain alone does not solve every browser's storage restrictions.

Google first tries a popup; only a blocked popup switches to redirect. Closing a popup gives a friendly retry message. New email accounts receive a verification email and can resend it in Account & connections; verification is encouraged but not required by the requested owner-only rules. Password reset messages avoid revealing whether an account exists.

`firebase.json` points to the committed rules and index exemptions. No Firebase console changes, rules deployment, account creation or real-account import was performed by implementation checks. The retired passphrase vault and its setup script have been removed; Firebase is the application authentication and journal storage layer. The React UI cannot run as a TradingView indicator, and MT5 synchronization remains unconnected.

Firebase configuration belongs to the browser build. The supplied Dockerfile accepts all six as build arguments because `.env.local` is excluded from the Docker context; runtime environment variables alone cannot configure an already-built browser bundle.

## Calculation conventions and limits

- Broker-reported **net realized P&L after fees** is authoritative. Fees are not deducted again. No XAUUSD contract-size or price-times-lots estimate is made.
- The reference has no per-trade currency or conversion model. Inputs and cash totals are explicitly **USD-only**; do not mix currencies.
- Realized metrics include **closed trades only**. Total P&L sums recorded net P&L.
- Win rate = profitable closed trades / all closed trades. Breakevens count in the denominator.
- Individual realized R = net P&L / initial cash risk. Average realized R is the arithmetic mean of those individual values, never planned reward:risk.
- Trades this week uses recorded trade dates in the viewer's local Monday–Sunday week.
- The chart starts at zero, accumulates realized P&L, and orders by recorded trade date with ID as a tie-breaker. The schema has no close timestamp or starting balance, so this is not an account-balance curve.
- Calculations keep numeric precision until display. Unrepresentable aggregate values show an unavailable state instead of NaN or Infinity.

Verified reference example: +$50 / $25 = +2R; −$25 / $25 = −1R; $0 / $25 = 0R. Together: **+$25 cash, +1R total, 1/3R average, and 1/3 win rate**. An open trade changes none of those realized metrics.

## Pocket previews and sharing

Header menus are mutually exclusive. Clicking outside, pressing Escape, or moving keyboard focus outside closes the open menu. Escape returns focus to its trigger; interaction inside and nested Alert Settings remain usable.

The Journal has responsive trade cards with separate View and Edit actions. View opens a short preview; full context, reflection, and screenshots expand on request. The overview keeps up to three open trades and their saved entry reasons nearby, plus the latest saved reflection. These are journal records, with no estimated live P&L. Mobile navigation stays within thumb reach at the bottom.

Share a single trade as text via the device share sheet, copy the summary, or save a locally generated PNG card. Sharing creates no public link and does not upload a separate public trade copy. Entry reasons and reflections are excluded by default; a checkbox explicitly includes them. Screenshots are never included. The PNG labels long notes as excerpts; the text summary contains the full included notes. Text remains selectable if native sharing or clipboard writing is unavailable.

See [TradingView / TradeZella research and proposed next steps](docs/tradingview-tradezella-research.md) for verified integration limits. Playbooks, reflections, generic CSV import and private snapshots are now implemented; a live TradingView chart and a broker-specific connector remain separate work.

## Feedback and original artwork

`FeedbackAnimation` lazy-loads the lightweight `lottie-web` player and local JSON. Static icons work without artwork. Reduced motion disables animation loading, counter motion, and CSS transitions. Event feedback is nonblocking and dismisses after 2.2 seconds. Loss feedback is calm and prompts review.

The first 10 records and five consecutive closed trades following the plan trigger deduplicated process milestones. The five-trade milestone counts plan adherence regardless of profit or loss, in recorded trade-date order. Ordinary edits, refresh, and Strict Mode do not replay already recognized milestones.

**Included original vector artwork** (generated from `scripts/create-feedback-art.mjs`):

```text
public/lottie/success.json
public/lottie/profit.json
public/lottie/loss.json
public/lottie/milestone.json
public/lottie/empty.json
public/lottie/loading.json
```

Each two-second composition is self-contained vector Lottie JSON under 102,400 bytes, without external images/fonts or expressions. Success shows a checkmark, profit a small upward arrow, loss a calm pause, milestones a star, empty states an open journal, and loading states three dots. See `public/lottie/README.md`. The prebuild validator rejects invalid installed artwork. Missing files fall back to Lucide icons and never break saving.

## Price alerts while the app is open

Open **Alerts → Alert Settings** in the header. Alerts are off by default. Enable them to monitor open trades only. Browser notification permission is requested only when you enable alerts or explicitly choose Enable browser notifications. Permission denial or an unsupported Notification API leaves the in-app notification center available. Clicking an alert opens its trade for review. No alerts are generated for closed or unsupported trades.

Supported symbols normalize `XAUUSD` / `XAU/USD` and the seven major forex pairs: EUR/USD, GBP/USD, USD/JPY, USD/CHF, AUD/USD, USD/CAD, NZD/USD. Each open pair has an adjustable move threshold (default **0.5%**). The alert interval defaults to **2 minutes** and controls the minimum time between notification deliveries and the per-trade cooldown. It does **not** control the free provider's sampling frequency.

The engine compares a quote to the recorded entry price and trade date, accounts for Long/BUY versus Short/SELL, and reports whether the price move is favorable or adverse. It never estimates cash P&L or changes saved results. It recognizes additional threshold steps or a new quote after cooldown, rather than repeating the same cached quote. Quotes older than ten minutes, before the trade date, or in the future are excluded. A queue releases at most one alert per configured interval; it drops pending alerts when their trade closes. Up to 50 recent alerts and deduplication state persist locally across refreshes. Web Locks elect one monitoring tab; browsers without Web Locks use a short-lived local lease. Monitoring fails safely when optional alert-history storage cannot be written.

### Provider evaluation and choice (checked 2026-10-19)

- **Alpha Vantage — selected.** Its [official documentation](https://www.alphavantage.co/documentation/) provides `GOLD_SILVER_SPOT` for gold and `CURRENCY_EXCHANGE_RATE` for forex under one adapter. Its [standard free limit](https://www.alphavantage.co/support/) is **25 requests per day**, so this app makes at most one new upstream request per hour across **all** pairs. Two active pairs therefore alternate, rather than each receiving an hourly quote. This is low-frequency monitoring, unsuitable for fast market alerts. The [terms](https://www.alphavantage.co/terms_of_service/) grant personal, non-commercial use; public/commercial distribution requires appropriate provider rights. Use a dedicated key so other applications do not consume the same allowance.
- **Twelve Data.** The [Basic plan](https://twelvedata.com/pricing) includes forex and lists 8 credits/minute and 800/day, but its [commodity exchange page](https://twelvedata.com/exchanges/commodity?group=core) places XAU/USD under Grow+/Venture+. It does not meet the combined free gold/forex requirement on that published tier.
- **gold-api.com.** Its [documentation](https://gold-api.com/docs) and [asset list](https://gold-api.com/assets/) provide free precious-metal/other asset quotes, including prices in different currencies, rather than a documented major-forex-pair feed. Its [terms](https://gold-api.com/terms) permit commercial use but prohibit abusive request patterns. It was not selected for combined gold/forex monitoring.

The provider is selected with `PRICE_PROVIDER=alphavantage`. `PriceProvider.getPrice(pair)` is the adapter interface in `app/lib/prices.server.ts`; the UI has no provider SDK or API key. `/api/price?pair=XAU%2FUSD` is the internal React Router resource route. It validates the pair, caches successful pair quotes for **120 seconds**, coalesces requests, and serializes a shared rolling 25-request/day budget. The budget is written before each upstream request and persists across server restarts. Errors/rate limits return a sanitized message and Retry-After; the client backs off. Missing configuration produces an honest setup message, never fabricated prices. Provider response fixtures are tested; actual account access and live responses still require your key and verification.

### Configure and run

```powershell
Copy-Item -LiteralPath .env.example -Destination .env
```

Edit `.env` locally (do not commit it):

```dotenv
PRICE_PROVIDER=alphavantage
ALPHA_VANTAGE_API_KEY=your_private_key
PRICE_STATE_DIR=.price-state
```

Run `npm.cmd run dev`, or `npm.cmd run build` followed by `npm.cmd start`. Restart after changing environment variables. Node 24 loads `.env` on the server. Never use a `VITE_` prefix for a secret. The client only sends the pair to the internal route; trade entries, notes, and screenshots are not sent to the price provider.

For the supplied Docker/Node setup, run **one Node process/replica** and mount a persistent writable volume at `PRICE_STATE_DIR` (for example `/app/.price-state`). Do not reset/delete that quota directory during the provider's quota window. The journal itself uses the signed-in Firebase account. Multiple server replicas or serverless instances require replacing the file budget/cache with a shared atomic store/limiter before deployment; a process-local cache alone cannot coordinate replicas. Add authentication before exposing a private keyed proxy as a public multi-user service. No hosted deployment is currently configured.

### Phase 4b: alerts after the app closes (documentation only)

True background delivery is not implemented. The current Node/Docker app would need an authorized background service and explicit opt-in records for alert inputs, durable push subscriptions, server-held VAPID keys, and a service worker handling Web Push and notification clicks. A hosting scheduler/cron or Docker sidecar would poll the adapter under the same shared quota guard, queue deliveries, and remove subscriptions when disabled or invalid. Browser permission remains user initiated. A suitable data plan and a shared budget would be needed for more frequent checks. This is a separate deployment feature, not something a page timer can provide.

## Verification

Vitest covers calculations, validation, notes, backup compatibility, storage failure, stale tabs, React forms, routes/hash redirects, filtering/deletion, milestone deduplication, reduced motion, missing artwork, mocked Lottie cleanup, clipboard fingerprint/session deduplication, price direction/threshold/cooldown/staggering, provider adapters, shared caching, and quota/backoff behavior. Tests use isolated storage and mocked provider responses, never seeded real journals or paid API calls.

```powershell
npm.cmd run test:browser
```

Playwright uses installed Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe` and the production app on port 4173. Build first, then run `npm.cmd run test:browser`. The current suite checks Firebase login, protected-route redirects, friendly sign-in errors, and light/dark layouts at 320, 375, 414, 768 and 1280 pixels. Test credentials are intercepted and never sent to the real Firebase project. Screenshots are written to ignored `test-results/`; no real browser profile is touched. Adjust `playwright.config.ts` for another OS/browser.

The obsolete browser fixtures for the retired unprotected local journal and passphrase vault were removed. Current journal workflows, calculations, backups, screenshots, migration, account isolation and stale-write handling remain covered by Vitest. `tests/helpers/legacy-journal-store.ts` is a test-only compatibility fixture for old browser backups; the app does not import that storage implementation. Live signed-in Firestore end-to-end testing still requires an isolated Firebase test project or emulator setup.

This is local verification; no hosting or deployment has been performed. Fonts use Google Fonts with local fallbacks when unavailable.
