# Tournament Management — Refactor Task Tracker

> Legend: `[ ]` todo · `[x]` done · `[-]` skipped/won't fix
> Priority: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low
> Source: Full codebase analysis — June 2026

---

## 🏗️ Architecture / Structure

- [x] 🔴 **[app/api/admin/auth/route.ts → lib/auth.ts]** `verifyAdminToken`, `hashPassword`, `verifyPassword`, `isAdminTokenValid` are defined inside a route file and imported by every other route
  - Importing from a route file is an antipattern — couples route modules, risks circular imports, leaks route-level side effects
  - Fix: move all four helpers into `lib/auth.ts` (currently only `canAccessTournament` lives there); update every importer (`tournamentAccess.ts`, `bracket/route.ts`, `tournaments/route.ts`) to import from `lib/auth`

- [x] 🔴 **[app/api/bracket/route.ts → lib/bracket.ts]** All bracket business logic (`buildSE`, `buildDE`, `seedLBDropIn`, `sweepBracket`, `isFeederResolved`, `stageFormat`, `emptyMatch`, `resolveWinner`) lives in the route file — ~350 lines of pure logic mixed with HTTP handlers
  - Fix: extract everything above into `lib/bracket.ts`; the route file becomes thin HTTP glue (parse request → call lib → return JSON)
  - Bonus: these functions can then be unit-tested in isolation

- [x] 🟠 **[lib/tournamentAccess.ts]** Still imports `verifyAdminToken` from `@/app/api/admin/auth/route` — blocked until the auth helpers are moved to `lib/auth.ts`
  - Fix: update import after the above is resolved

- [x] 🟠 **[lib/types.ts]** `TournamentState` deprecated alias removed — replaced with `ServerState` everywhere. `kv.ts` and all route handlers updated.

- [x] 🟡 **[lib/kv.ts]** Added `safeState(s: ServerState): ClientState` helper that strips `adminPwHash` and `ownerAdminId` in one place. `state/route.ts`, `state/stream/route.ts`, and `reset/route.ts` all use it.

- [x] 🟡 **[app/api/ffa/route.ts]** Fixed lazy dynamic import in GET handler — now uses static top-level `import { getState } from '@/lib/kv'`.

---

## ♻️ Redundancy / Consistency

- [ ] 🟠 **[lib/context.tsx]** `apiFetch` internal helper not yet extracted — ~30 fetch calls still repeat Content-Type + auth header boilerplate.

- [ ] 🟠 **[lib/context.tsx]** Guard field names not yet standardised as a const union/enum.

- [ ] 🟡 **[app/api/bracket/route.ts]** `cloneBracket` helper not yet extracted to `lib/bracket.ts`.

- [ ] 🟡 **[app/api/bracket/route.ts]** `propagateWinner` / `clearWinner` helpers not yet extracted.

- [ ] 🟡 **[app/api/maps/route.ts + lib/context.tsx]** `removeSpinQueueItem` is still fire-and-forget (no await on fetch response). Low impact.

- [x] 🟡 **[app/page.tsx]** Extracted `<TickerEditModal>` as a named component with `displayName`.

- [x] 🟡 **[app/page.tsx]** Deduplicated admin state — `Home` now uses `useAdminSession()` directly instead of duplicating `useEffect` + separate state.

- [x] 🟢 **[app/api/maps/route.ts]** `DELETE` handler now also filters `stageMaps` to remove ghost references to the deleted map.

- [x] 🟢 **[app/api/teams/route.ts]** Removed unused `teamMode` destructure in `assignments` branch; `teamMode` is only destructured in the main formation path.

---

## 🔒 Security (Remaining)

- [ ] 🔴 **[app/api/admin/auth/route.ts]** No brute-force protection on `POST /api/admin/auth` — unlimited password guesses from any IP
  - Fix: integrate Upstash Ratelimit: 5 attempts per minute per IP; return `429` with a `Retry-After` header on breach

- [x] 🟠 **[app/api/players/route.ts]** POST body now whitelists only `{ name, joinKey }` — extra keys ignored.

- [ ] 🟠 **[app/api/admin/auth/route.ts]** Token has no binding to the requester — any client that intercepts a token can use it from any origin/IP/device

- [ ] 🟡 **[All API routes]** No CORS headers

- [x] 🟡 **[app/api/players/route.ts]** Case-insensitive dedup now applied consistently: both queue POST and `addToRoster` guard with `.toLowerCase()`.

---

## 🐛 Bug Fixes (Remaining)

- [ ] 🔴 **[lib/kv.ts]** Runtime assertion in `ensureDefaultAdmin` — verify `pwHash` contains `:` before saving.

- [x] 🔴 **[app/api/state/stream/route.ts]** SSE now tracks `lastSentHash` (MD5 of JSON-stringified state) per connection and only pushes when the hash changes — eliminates redundant pushes and reduces spectator update lag to near-zero.

- [ ] 🟠 **[app/api/bracket/route.ts]** `sweepBracket` called unconditionally on entire bracket after every score change — should start from affected round `ri`.

- [x] 🟠 **[app/api/players/route.ts]** Duplicate name check moved inside `updateState` updater — now runs atomically with the write, preventing race conditions.

- [ ] 🟡 **[MapsTab.tsx]** `drawWheel` uses `'var(--bg-elevated)'` as canvas `fillStyle` — CSS variables don't resolve in canvas; needs `getComputedStyle` lookup.

- [ ] 🟡 **[lib/context.tsx]** `resetAll` does not reset `maps` local state — maps remain in UI until next SSE push. (Note: the API intentionally preserves maps across reset; this is about the local state sync gap.)

- [ ] 🟡 **[TeamsTab.tsx]** `isVisible()` flash on first render after `formTeams`.

- [x] 🟢 **[lib/kv.ts]** `getState` and `listTournaments` now `console.error` on catch before returning defaults. `updateState` now `console.warn` on retry and `console.error` on fallback.

---

## 🔁 Code Quality / Types

- [ ] 🟠 **[app/api/bracket/route.ts + POST handler]** `action === 'generate'` duplicates SE round-building loop instead of calling `buildSE`.

- [ ] 🟡 **[app/api/teams/route.ts]** ~~Team color repetition for 10+ teams~~ — **DONE**: now uses HSL color generation when team count exceeds palette length.

- [x] 🟡 **[app/api/teams/route.ts]** Dynamic HSL color generation for >8 teams: `hsl(${(i * 360 / n) % 360}, 70%, 55%)`.

- [ ] 🟡 **[lib/context.tsx]** `TourneyContext` interface still inline — could be moved to `lib/types.ts`.

- [ ] 🟡 **[All components]** No `displayName` on inner/anonymous components (BracketTab, PlayersTab, etc).

- [ ] 🟡 **[app/api/maps/route.ts]** Dead `updateSpinState` action — not wired to any context method.

- [ ] 🟢 **[next.config.ts]** Empty config — `typedRoutes`, comments, and `output: 'standalone'` not yet added.

- [ ] 🟢 **[All components]** `<HoverButton>` wrapper for inline `onMouseEnter`/`onMouseLeave` hover patterns not extracted.

- [x] 🟢 **[lib/kv.ts]** `updateState` retry/fallback logging added.

---

## 🎨 UX / Design (Prioritised)

### Global

- [ ] 🔴 **[All tabs]** Each tab must fit within one viewport — `PlayersTab`, `BracketTab`, `MapsTab` overflow on 1080p.

- [x] 🔴 **[context.tsx + api/state/stream/route.ts]** SSE hash dedup fix — spectators now receive real-time updates with minimal latency.

### Players Tab

- [ ] 🟠 **[PlayersTab.tsx]** Remove `byAdmin` badge (👑) and role text.
- [ ] 🟠 **[PlayersTab.tsx]** Remove "Add as Admin" toggle button.
- [ ] 🟠 **[PlayersTab.tsx]** Input not disabled synchronously on submit.
- [x] 🟠 **[PlayersTab.tsx + api/players/route.ts]** Admin can now rename/replace a player mid-tournament via `PATCH /api/players` action `renamePlayer` — updates `players`, `roster`, and `teams` atomically. Context method `renamePlayer` added.

### Bracket Tab

- [x] 🔴 **[BracketTab.tsx + api/bracket/route.ts]** BO1/BO3 format selector UI — already present; confirmed working.
- [x] 🔴 **[BracketTab.tsx]** Ghost bracket previews — added `GhostMatchCard` skeleton on pre-generate empty state; `GhostBracketOverlay` (blur + CTA) on generated-but-not-seeded state.
- [x] 🔴 **[BracketTab.tsx + api/bracket/route.ts]** Seed/shuffle step UI — added `StepIndicator` (Format → Generate → Shuffle); "Shuffle Teams" button is primary green CTA when unseeded, secondary "Re-Shuffle" when already seeded; `handleShuffle` extracted and shared between toolbar and overlay.
- [x] 🟠 **[BracketTab.tsx]** SVG connector lines — already implemented in `SingleElimCanvas` and `DoubleElimCanvas`.
- [x] 🟠 **[BracketTab.tsx + api/bracket/route.ts]** Score input — click-to-edit numeric input already present on `PlayerRow`; confirmed working.

### Teams Tab

- [ ] 🟡 **[TeamsTab.tsx]** Review admin vs. non-admin UI layout.

### Maps Tab

- [ ] 🔴 **[MapsTab.tsx + api/maps/route.ts]** Rework spin flow: landed map should move to `usedMaps` pool, not be deleted from master list.
- [ ] 🟠 **[MapsTab.tsx]** Show "Current Round Map" prominently after spin.
- [ ] 🟡 **[MapsTab.tsx]** No visual feedback when map is dropped onto a stage slot.

---

## 🚀 Enhancement (Remaining)

- [-] 🟠 **[BracketTab.tsx]** No SVG connector lines. (Already implemented — duplicate of item above.)
- [x] 🟠 **[TeamsTab.tsx + api/teams/route.ts]** Added `swapPlayer` action to `PATCH /api/teams` and `swapPlayer` context method — moves a player between teams atomically.
- [ ] 🟡 **[PlayersTab.tsx]** No queue cap / "lock queue" toggle.
- [ ] 🟡 **[page.tsx]** No connection status indicator.
- [ ] 🟡 **[AdminModal.tsx]** No 403 session expiry feedback.
- [ ] 🟢 **[page.tsx]** Tab bar no scroll affordance on mobile.
- [ ] 🟢 **[BracketTab.tsx]** Champion banner `animate-pulse-glow` runs indefinitely.
- [ ] 🟢 **[MapsTab.tsx]** Wheel canvas fixed at 260×260 — not responsive.

---

## 🆕 Generic hooks

- [x] **[hooks/useSSE.ts]** Extracted generic `useSSE<T>(url, onData, pollInterval?, deps?)` hook. `useTournaments` refactored to use it.
