# Tournament Management — Improvement Plan
> Reanalyzed: June 2026 · All prior items resolved ✅
> Legend: `[ ]` todo · `[x]` done · `[-]` skipped/won't fix
> Priority: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low

---

## 🔒 Security

- [ ] 🔴 **[app/api/chat/route.ts]** Chat POST has no auth guard — anyone can post as any name. Add optional admin-only mode or at minimum a simple name-spoof check (e.g. block names that match registered admin names).

- [ ] 🔴 **[app/api/state/route.ts]** GET /api/state returns full client state with no rate-limiting. A public tournament can be polled indefinitely. Add a lightweight in-memory or KV-based rate limit (e.g. 60 req/min/IP).

- [ ] 🟠 **[app/api/upload/route.ts]** Verify file upload MIME type server-side (not just `accept` attribute on input). Reject non-image content-types and enforce a max file size (e.g. 5 MB) to prevent abuse of Vercel Blob storage.

- [ ] 🟠 **[lib/auth.ts → verifyAdminToken]** Token fingerprint uses IP + Origin hash. Behind Vercel's edge, `x-forwarded-for` can be spoofed or rotate on mobile networks. Consider making fingerprint-mismatch a soft warning (log it) rather than a hard rejection, or document the trade-off clearly.

- [ ] 🟡 **[app/api/admin/route.ts (super admin panel)]** Super admin actions (delete account, toggle isSuperAdmin) should require re-authentication or a second factor (e.g. confirm current password) to prevent session-hijack escalation.

---

## 🐛 Bug Fixes

- [ ] 🔴 **[components/MapsTab.tsx → drawWheel]** `maps.length` is used for font-size calculation (`140 / maps.length`) but the wheel only shows `wheelMaps` (master pool minus used maps). Font size should scale with `wheelMaps.length` to avoid oversized text when most maps are used.

- [ ] 🔴 **[components/MapsTab.tsx → spin()]** `spinning || !maps.length` guard — should be `spinning || wheelMaps.length === 0`. If all maps are in `usedMaps`, the SPIN button is incorrectly still enabled because `maps.length > 0`.

- [ ] 🟠 **[lib/kv.ts → updateState]** Lua CAS script falls back to a non-atomic `getState` + `setState` after 5 retries. Under high write contention (many concurrent score updates) this can cause lost writes. Add a jitter-based exponential back-off before the fallback, or increase MAX_RETRIES to 8.

- [ ] 🟠 **[app/api/bracket/route.ts → undoMatch action]** When undoing a match whose winner was propagated into the Grand Final in DE mode, the GF `p1`/`p2` is cleared but `bracket.champion` is NOT reset if the GF was already complete. This leaves a stale champion after an undo. Add `bracket.champion = null` whenever GF is touched during undo.

- [ ] 🟠 **[components/BracketTab.tsx]** Third-place match is rendered in SE mode even when `teamCount < 4`. The `buildEmptySE` guard adds `thirdPlace` only for ≥ 4 teams, but the UI renders the thirdPlace section unconditionally if `bracket.thirdPlace` exists. Add a guard: only render if `bracket.upper[0].length >= 2` (i.e. ≥ 4 entrants).

- [ ] 🟡 **[hooks/useSSE.ts]** On `es.onerror`, the hook starts polling AND keeps the EventSource reference alive momentarily (it is closed but not nulled before the polling check `if (!pollTimer)`). If the browser fires `onerror` multiple times (e.g. repeated reconnect attempts), multiple poll intervals can be spawned. Fix: set `pollTimer` immediately before `fetchOnce()` or null-guard more carefully.

- [ ] 🟡 **[components/MapsTab.tsx → spin tick closure]** `activeCategoryRef` and `itemCategoryRef` are read after `await appendSpinQueueRef.current(result)`. If the component unmounts during that await, refs are stale but the async continuation still runs `saveItemCategory`. Add an `isMounted` ref guard around the post-await block.

- [ ] 🟡 **[app/api/ffa/route.ts]** `setFFAPlayers` action replaces `ffa.players` without validating names against the existing player queue/roster. A super admin could set arbitrary strings. Add name-length and character validation consistent with the player submission rules.

- [ ] 🟢 **[lib/bracket.ts → sweepBracket]** The outer `while (sweepAgain)` loop has no iteration cap. A pathological bracket state (e.g. all byes, circular reference bug) could cause an infinite loop on the server. Add a max-iterations guard (e.g. 500) with a console.error and break.

---

## ♻️ Code Quality / Refactor

- [ ] 🟠 **[components/MapsTab.tsx]** Component is ~700 lines. Extract into sub-components:
  - `WheelPanel` (canvas, map list, add-map form)
  - `SpinResultsPanel` (queue, categories, drag-drop)
  - `DefaultMapsFooter`
  - Keep `MapsTab` as a thin orchestrator. This will also make the `spin` closure and `drawWheel` easier to test.

- [ ] 🟠 **[lib/context.tsx]** Context file is very large (likely 600–900+ lines). Split into domain-specific hooks:
  - `usePlayers()` — player/roster mutations
  - `useTeams()` — team formation/swap/rename
  - `useBracket()` — bracket generation/scoring/undo
  - `useMaps()` — map/spin/stage operations
  - `useFFAContext()` — FFA match mutations
  - `useChat()` — chat send/clear
  - Keep `TourneyProvider` as a composition root that aggregates them.

- [ ] 🟠 **[app/api/* routes]** Several routes (`/api/players`, `/api/teams`, `/api/bracket`, `/api/ffa`) use a large `action` switch dispatched from a single POST handler. As features grow this becomes hard to navigate. Consider splitting into sub-routes (e.g. `/api/teams/[action]/route.ts`) or a typed action-handler registry map.

- [ ] 🟡 **[components/FFATab.tsx]** `MapInfoForm`, `ScoreTabSection`, `WinnersSection`, and `MatchCard` are all defined in the same file (~500 lines). Extract each to its own file under `components/ffa/`.

- [ ] 🟡 **[lib/types.ts]** `TourneyContext` interface is very large (~80 methods). Group into logical namespaces or split into separate `PlayerActions`, `TeamActions`, `BracketActions`, `MapActions`, `FFAActions`, `ChatActions` interfaces composed into `TourneyContext`. Improves IntelliSense discoverability.

- [ ] 🟡 **[app/page.tsx]** `MainApp` renders all tab components simultaneously (hidden via `hidden` CSS class) rather than lazy-mounting. For large tournaments this means all tabs hydrate on load. Switch to conditional rendering with `activeTab === 'x' && <XTab />` or React.lazy/Suspense per tab.

- [ ] 🟢 **[lib/kv.ts]** `kvKey()` silently strips invalid characters. If the resulting key is empty (all-invalid id), it falls back to `'tournament:state:default'` — which would collide with the real default tournament. Add an explicit check and throw or return an error if `safe` is empty after sanitization.

- [ ] 🟢 **[All API routes]** No structured logging. Add a thin `logRequest(req, action, tournamentId)` helper that logs method, path, action, tid, and adminId (redacted) in JSON format. Useful for debugging and Vercel log queries.

---

## 🎨 UX / Design

- [ ] 🟠 **[components/MapsTab.tsx]** No visual feedback when a map is dragged onto a stage slot in the bracket. Implement a drag-enter highlight on stage slot drop zones (the TODO left from the prior session: "No visual feedback when map dropped onto stage slot").

- [ ] 🟠 **[components/FFATab.tsx → MatchCard]** Player scores are not shown on the match card. The `FFAMatch.scores` array exists but the UI only shows map info, score-tab image, and winners. Add a compact score leaderboard section between the map info table and the Score Tab section, visible to all users.

- [ ] 🟠 **[components/ChatPanel.tsx]** Chat is hidden behind a floating toggle and not integrated into the tab nav. Consider adding chat as a sixth tab (`TabId: 'chat'`) so spectators can find it without discovering the floating button. The `chat` TabId already exists in `lib/types.ts`.

- [ ] 🟡 **[app/page.tsx → MainApp]** The SSE status indicator is hidden on mobile (`hidden sm:inline-flex`). On mobile, connection drops are silent. Show a minimal dot indicator (no label) that is always visible, or integrate it into the header title area.

- [ ] 🟡 **[components/TournamentPicker.tsx]** No search/filter for tournaments. Once a super admin has 10+ tournaments, the picker becomes hard to navigate. Add a simple text-filter input above the grid.

- [ ] 🟡 **[components/BracketTab.tsx]** Champion banner ("🏆 CHAMPION") has a pulse animation that runs indefinitely. Cap it at ~5 seconds using a CSS animation with `animation-iteration-count` or a `setTimeout` that removes an `animate-pulse` class.

- [ ] 🟡 **[components/AdminModal.tsx]** On 403/401 responses after session expiry (token TTL 8h), the UI silently fails — no message shown. Detect 401/403 from admin API calls in context and either show a toast or reopen the AdminModal with an "Session expired" message.

- [ ] 🟢 **[app/globals.css or layout.tsx]** No `<meta name="theme-color">` for mobile browsers. Add dynamic theme-color meta (dark: `#0d0d0d`, light: `#f5f5f5`) matching the `t-bg` CSS variable to improve mobile chrome appearance.

- [ ] 🟢 **[components/BottomTicker.tsx]** Ticker text is not paused on hover/focus (accessibility). Add `animation-play-state: paused` on `:hover` and `:focus-within` so keyboard users and readers can catch the text.

---

## 🚀 Features / Enhancements

- [ ] 🟠 **[components/FFATab.tsx + app/api/ffa/route.ts]** No per-player score entry UI in the client. `FFAMatch.scores` and `updateFFAScore` / `setFFAScores` context methods exist but are never called from the UI. Build a score-entry panel inside `MatchCard` (admin only, hidden when locked) that lets the admin enter kills per player and save.

- [ ] 🟠 **[components/BracketTab.tsx + app/api/bracket/route.ts]** No way to export the bracket as an image or PDF. Add a "Download bracket" button that uses `html-to-image` or `canvas.toBlob()` to snapshot the bracket SVG/canvas for sharing.

- [ ] 🟡 **[app/api/tournaments/stream/route.ts (or new)]** Tournament list has no real-time updates. When a super admin creates/deletes a tournament while other admins are on the picker screen, they don't see it until refresh. Add a `/api/tournaments/stream` SSE endpoint mirroring the pattern from `/api/state/stream`.

- [ ] 🟡 **[components/TournamentPicker.tsx → TournamentCard]** Tournament cards don't show participant count, bracket type, or current status (e.g. "In Progress", "Completed"). Add a lightweight status badge derived from `bracket.champion` (Completed) or `bracket !== null` (In Progress) by fetching a minimal state summary.

- [ ] 🟡 **[lib/kv.ts]** No TTL on tournament state keys. Old abandoned tournaments accumulate in KV indefinitely. Add an optional `archiveAfterDays` field to `TournamentMeta` and a cleanup workflow/cron that deletes state keys older than the threshold (Vercel Cron or an admin-triggered endpoint).

- [ ] 🟢 **[workflows/]** Only `example.md` exists. Add real workflow SOPs for the most common admin tasks:
  - `workflows/create_tournament.md`
  - `workflows/run_bracket.md`
  - `workflows/run_ffa.md`
  - `workflows/spin_maps.md`
  These make the WAT framework actually usable as documented in `CLAUDE.md`.

- [ ] 🟢 **[tools/]** No tools directory contents visible. Add at minimum:
  - `tools/reset_tournament.py` — CLI script to wipe a tournament's KV state by ID
  - `tools/export_bracket.py` — fetch and pretty-print bracket JSON for debugging

- [ ] 🟢 **[next.config.ts]** `typedRoutes` experimental flag not enabled. Enable it to get compile-time validation of `href` props and `redirect()` calls across the app.
