# Dashboard UI refresh

The existing React Router routes, Firebase repository, optional trade fields, backup/import/export, alerts, reviews and screenshot workflows remain in place. No UI framework or production data was added.

| Screen | Changes |
| --- | --- |
| Shared workspace | Five navigation destinations; collapsible desktop sidebar; safe-area bottom tabs and floating Add Trade on mobile. URL/session date presets, pair and setup filters on Dashboard, Journal and Reports. Desktop-only Ctrl/Cmd+K and N; input fields and open dialogs are excluded from shortcuts. |
| Dashboard | Five metrics with real sparklines and equally long previous-period comparisons. Equity tooltip, keyboard scrubber and peak-to-equity drawdown shading. Calendar drill-down, searchable recent trades that become mobile cards, existing open trades and latest reflection. |
| Journal | Comfortable/compact session preference; existing search, outcome/tag filters, pagination and edit/view controls retained. Compact mobile cards and 44 px controls. |
| Reports | Shared filters and reusable calendar; existing metrics/groupings, weekly behavior review and range export retained. Helpful empty-state action. |
| Playbooks | Existing playbook editor, checklist snapshots, daily reflections and grouped review under the Playbooks navigation label; `/review` stays available. |
| Settings | System/light/dark appearance control alongside timezone/risk settings and existing setup management. |
| Trade detail/edit | Right drawer on desktop; full-screen mobile sheet using `100dvh` and VisualViewport resize/scroll updates. Separate Delete and sticky Save actions. Existing screenshots load only on opening their trade (at most three); before/after labels are inferred only from saved filenames. Missing target/exit/rating values stay explicitly unrecorded. |
| Loading/offline | Layout skeletons replace the large loading message. Existing Lottie feedback and counters respect reduced motion. Manifest, static install icons and a friendly offline page support installation. |

The default selected range is 30 days. Firestore reads only that range plus its immediately preceding comparison period, with 200-record cursor pages and the existing five-range memory cache. Pair/setup filtering and calculations happen in memory. Filters/density write only session preferences, never Firestore; sign-out removes these account-sensitive session keys. Financial records are not migrated. Risk warnings and optional price-alert monitoring continue to consider loaded records across pairs, even when a pair/setup filter is active. Alert links can open a loaded trade outside the current display filter.

The service worker registers only in production. It caches exactly `/offline.html`, `/theme.js`, and the 192/512 px install icons. Navigation remains network-first; failed navigation receives the static offline page. It never stores authenticated HTML, API responses, trades or screenshots. Offline trade editing/saving is not offered.

## Verification artifacts

- `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test -- --maxWorkers=2`, `npm.cmd run build`.
- Start the isolated fixture with `node scripts/visual-server.mjs`, then run `node scripts/audit-ui-refresh.mjs`. It uses the actual workspace/routes/styles with test-only providers, fictional trades and local chart fixtures. Authentication, alerts and onboarding are stubbed in this harness; it is not imported by production code. No Firebase credentials or live data are used.
- The capture matrix covers Dashboard, Journal, Reports, Playbooks, Settings, trade view and trade edit at **320, 375, 414, 768 and 1280 px**, in **light and dark**. Additional captures cover the command palette, collapsed sidebar, and a focused form at 430 px viewport height. Screenshots and geometry/error logs are under ignored `test-results/ui-refresh/`.
- `node scripts/check-mobile-geometry.mjs` checks mobile hit targets; `node scripts/audit-pwa.mjs` starts the local production server, checks manifest/cache contents and exercises offline navigation in both themes.
- Reduced viewport height simulates space taken by the on-screen keyboard. Real-device IME/keyboard behavior remains a separate physical-device check.

Existing route tests were updated only for the requested Dashboard and Playbooks heading changes. Additional pure tests cover inclusive date presets, previous-period boundaries and URL/session validation. Existing authentication/trade/rules security behavior is retained.
