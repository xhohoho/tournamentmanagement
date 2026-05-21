# Tournament Management — Task Tracker

> Legend: `[ ]` todo · `[x]` done · `[-]` skipped/won't fix
> Priority: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low

---

## 🐛 Bug Fixes

- [x] 🔴 **[context.tsx + AdminModal.tsx]** Admin token never stored in context — `assignLeader` always 403
  - Token was trapped in `AdminModal` local state, never passed to `adminHeaders`
  - Fixed: exposed `setAdminToken` on context, called it from `AdminModal` on login

- [x] 🔴 **[kv.ts]** `adminPwHash` stored as plaintext — password is `"admin123"` in `defaultState()`
  - Anyone who reads the KV store sees the password directly
  - Fixed: password hashed with `crypto.scrypt` (salt:hash format) on write; `verifyPassword` handles both legacy plaintext and new hashed values; auto-upgrades plaintext on first successful login

- [x] 🔴 **[api/admin/auth/route.ts]** In-memory token store (`validTokens`) is lost on server restart / redeployment
  - On Vercel, serverless functions spin up fresh — all tokens are wiped, forcing re-login silently
  - Fixed: tokens stored in Vercel KV with 8h TTL (`admin:token:<hex>` keys); `verifyAdminToken` is now async and checks KV; added `DELETE /api/admin/auth` to revoke tokens on logout; `context.tsx` calls it when admin logs out

- [x] 🟠 **[api/teams/route.ts]** Team formation (`POST`) has no auth check for the main creation path
  - Any unauthenticated client can call `POST /api/teams` and regenerate teams
  - Fixed: `verifyAdminToken` guard added to `POST`, `DELETE`, `PATCH`; redundant `authorizeAdmin` wrapper removed; auth check now at top of `POST` before any body parsing

- [x] 🟠 **[api/players/route.ts]** `addToRoster` has no auth check — any user can add themselves to the roster
  - The UI hides the button for non-admins but the API is wide open
  - Fixed: `DELETE` and all admin `PATCH` actions (`addToRoster`, `removeFromRoster`, `setRoster`, `clearQueue`, `clearRoster`) now require admin token; server-side name length check (≤24) also added here

- [x] 🟠 **[api/bracket/route.ts]** Score updates (`PATCH`) have no auth check
  - Any client can call `PATCH /api/bracket` and change scores
  - Fixed: `verifyAdminToken` guard added to `POST`, `PATCH`, `PUT`, `DELETE`

- [x] 🟠 **[api/maps/route.ts]** Map add/delete/assign has no auth check
  - Fixed: `verifyAdminToken` guard added to `POST`, `DELETE`, `PATCH`

- [x] 🟠 **[api/reset/route.ts]** `DELETE /api/reset` has no auth check — anyone can wipe the tournament
  - Fixed: `verifyAdminToken` guard added; `context.tsx` updated to pass `adminHeaders` to all previously unprotected fetch calls

- [x] 🟡 **[api/bracket/route.ts]** Double elimination lower bracket logic is incomplete
  - Losers are dropped into `lower_r{ri*2}` but there's no logic to build consolidation rounds (LB winner advancing, alternating rounds)
  - The lower bracket grows uncontrolled and doesn't properly produce a single LB finalist
  - Fixed: rewrote `buildDE()` to pre-allocate the full LB skeleton (2*(U-1) rounds, alternating drop-in/consolidation); `seedLBDropIn()` deterministically places UB losers using `ri*2` drop-in mapping + `slotHint`; winner propagation in `PATCH` now correctly routes LB Final winner → `grandFinal.p2`; `autoByes` runs after each seeding; single-elim 3rd place and GF champion logic preserved

- [x] 🟡 **[TeamsTab.tsx]** Reveal animation `revealOrderMap` is recomputed every time `teams` reference changes (polling every 4s)
  - `useMemo` depends on `teams` — each poll replaces the array reference, reshuffling the reveal order for members not yet visible
  - Fix: seed the map once on `formTeams` success and store it in a `useRef`, not `useMemo`

- [x] 🟡 **[context.tsx]** `setElimMode` is client-side only — does NOT persist to KV
  - The `PATCH /api/bracket` with `action: 'setElimMode'` exists in the route but `context.tsx` never calls it
  - After a page refresh, `elimMode` reverts to whatever is stored (default `'single'`)
  - Fix: make `setElimMode` async, call `PATCH /api/bracket` with `{ action: 'setElimMode', elimMode }`

- [x] 🟡 **[MapsTab.tsx]** Wheel pointer (▶) is positioned above the canvas with `rotate-90` but its alignment is purely visual/approximate — the math in `spin()` normalises angle from 12 o'clock (top), not 3 o'clock (right)
  - The picked map can be off by one slice in certain angle ranges
  - Fix: align pointer to the right (3 o'clock, angle 0) or adjust the normalisation formula to match pointer position

- [x] 🟢 **[PlayersTab.tsx]** Drag-and-drop `dragging` state is set via `handleDragStart` but never cleared on `dragend`
  - If the user drags and drops outside a valid target, `dragging` stays set
  - Fix: add `onDragEnd` handler to clear `setDragging(null)` on both queue items and roster items

---

## 🔒 Security

- [x] 🔴 **[kv.ts]** Hash the admin password — see Bug Fixes above

- [x] 🟠 **[All API routes]** Add auth middleware — see Bug Fixes above (teams, players, bracket, maps, reset)

- [x] 🟡 **[api/players/route.ts]** No rate limit on `POST /api/players` — anyone can spam the queue with fake names
  - Fix: add IP-based rate limiting (e.g. Vercel Edge middleware, or upstash ratelimit library)

- [x] 🟡 **[api/players/route.ts]** Player name has no server-side max-length check (only `maxLength={24}` in the UI)
  - Fix: validate `trimmed.length <= 24` in the POST handler

---

## ♻️ Redundancy / Consistency

- [x] 🟡 **[lib/utils.ts]** `TEAM_COLORS` and `WHEEL_COLORS` are identical arrays — only `WHEEL_COLORS` has two extra entries
  - `TEAM_COLORS` is used for team card borders; `WHEEL_COLORS` for the spin wheel
  - Fix: define one `BASE_COLORS` array, then `WHEEL_COLORS = [...BASE_COLORS, '#78c6ff', '#ffd966']`

- [x] 🟡 **[MapsTab.tsx + api/maps/route.ts]** `stageMaps` value type inconsistency — stored as `string[]` in KV but cast with `as unknown as string` in many places
  - The type in `types.ts` is `Record<string, string[]>` but old KV data may have scalar strings
  - Fix: normalise all reads through a single `getStageMaps(key)` helper (already partially done in `MapsTab`) and remove the `as unknown as` casts everywhere by ensuring KV always writes arrays

- [x] 🟡 **[BracketTab.tsx]** `MatchCard` and `GrandFinalDisplay` render nearly identical JSX (player rows, BO3 score buttons, BO1 winner buttons)
  - Fix: extract a shared `PlayerRow` component and a `ScoreControls` component used by both

- [x] 🟡 **[BracketTab.tsx]** `ThirdPlaceDisplay` duplicates the player row render logic from `MatchCard`
  - Fix: same as above — share `PlayerRow` / `ScoreControls`

- [x] 🟡 **[context.tsx]** `removeSpunMap` is just an alias for `removeMap` — exported separately but identical
  - Fix: remove `removeSpunMap` from context interface and just call `removeMap` directly in `MapsTab`

- [x] 🟢 **[page.tsx]** Dark mode stored in `useState` — resets to light on every page refresh
  - Fix: persist preference to `localStorage` and initialise from it (with a `useEffect` to avoid SSR mismatch)

- [x] 🟢 **[AdminModal.tsx]** `sessionToken` local state in `AdminModal` is now redundant — `adminToken` in context holds the same value
  - Fix: remove `sessionToken` local state; read `adminToken` from context (needs context to expose it as readable value)

---

## 🚀 Enhancement

- [x] 🟠 **[context.tsx]** Polling every 4s with a full `/api/state` fetch is wasteful — every spectator and admin hammers the KV store
  - Fix: replace with Server-Sent Events (SSE) or long-polling so the server pushes updates only when state actually changes
  - Fixed: `/api/state/stream` SSE endpoint implemented (`app/api/state/stream/route.ts`); `context.tsx` connects via `EventSource` and falls back to 4s polling only on error

- [x] 🟠 **[api/teams/route.ts + context.tsx]** No optimistic update on `formTeams` — UI shows stale teams until the next poll after a reset+reform cycle
  - Fix: return and immediately apply the new teams from the `formTeams` API response (already done), but also clear `bracket` optimistically in context

- [x] 🟡 **[TeamsTab.tsx]** In Fully Random mode, the `✓` assign-leader button shows on every member
  - After assigning a leader, the button disappears for that person but remains on all others — clicking a second member replaces the first leader silently
  - Enhancement: show a subtle "change" indicator on the current leader instead of just hiding the button, so admin knows reassignment is possible

- [x] 🟡 **[BracketTab.tsx]** No way to undo/revert a score once set — the match is locked with no reset option
  - Fix: add a small ✕ / undo button on completed matches (admin only) that clears `winner`, `score1`, `score2` and re-propagates
  - Fixed: `undoMatch` action added to `PATCH /api/bracket`; `↩ Undo` button rendered in `MatchCard` for admin on completed matches; reverse propagation (winner, loser, LB drop-in, 3rd place seeding) fully implemented

- [x] 🟡 **[PlayersTab.tsx]** Admin can add players via the same queue form as regular users (`byAdmin` flag exists but there's no dedicated "add as admin" UI path)
  - Fix: add a separate "Add by Admin" input or a toggle on the submit button so admin-added players get the `byAdmin: true` flag and the 👑 badge

- [x] 🟡 **[MapsTab.tsx]** Spun map result (`spunMap`) resets on page refresh — no persistence
  - If the admin spins and then changes tabs, the result is gone
  - Fix: store last spun map in context (or at least component-level across tab switches via `useState` lifted to page)

- [x] 🟢 **[layout.tsx]** Google Fonts loaded via `<link>` in `<head>` — causes render-blocking and a console warning in Next.js 14+
  - Fix: use `next/font/google` for `Bebas_Neue`, `DM_Mono`, and `Syne` instead
  - Fixed: `layout.tsx` already uses `next/font/google` for all three fonts with CSS variables and `display: swap`

- [x] 🟢 **[page.tsx]** Player count badge on the Players tab only counts the queue (`players.length`), not the roster
  - Could be confusing — a player in the roster is no longer a pending queue item
  - Fix: show separate indicators or change badge to show roster count when it differs

- [x] 🟢 **[TeamsTab.tsx]** No feedback when `formTeams` is in-flight — the "Form Teams" button has no loading state
  - Fix: add a `forming` boolean state, disable + show spinner on the button while awaiting the API

- [-] 🟢 **[globals.css]** `t-header` utility uses `--header-bg` but the class is only used once (in `page.tsx`) — could just be an inline style or a direct Tailwind arbitrary value
  - Minor: not worth changing unless doing a CSS cleanup pass

---

## 🧹 Code Quality / Types

- [x] 🟡 **[lib/types.ts]** `TournamentState.adminPwHash` should never leave the server but the type is shared client/server
  - Fix: split into `ServerState` (with `adminPwHash`) and `ClientState` (without), use `ClientState` on the frontend
  - Fixed: `types.ts` defines `ServerState`, `ClientState = Omit<ServerState, 'adminPwHash'>`, and keeps `TournamentState` as a deprecated alias; `/api/state/stream` and `/api/reset` already destructure out `adminPwHash` before responding

- [x] 🟡 **[api/bracket/route.ts]** `autoByes` mutates its input array directly — side-effectful and hard to test
  - Fix: return a new array / make it a pure function
  - Fixed: `autoByes` now deep-copies input via `rounds.map(r => r.map(m => ({ ...m })))` and returns the new array; callers pass working copies without needing a separate clone

- [x] 🟡 **[context.tsx]** `useTourney` hook has no loading guard — components that call it during initial load may render with empty arrays before `refresh()` completes
  - `loading` is exposed but most tab components don't check it
  - Fixed: `BracketTab`, `TeamsTab`, `PlayersTab`, and `MapsTab` all check `loading` and return animated pulse skeletons before data is ready

- [-] 🟢 **[api/teams/route.ts]** `teamMode` read from POST body but the route also sets it — if `assignments` branch fires, the `teamMode` from body is ignored but the variable is still destructured
  - Won't fix: code is correct, purely cosmetic; destructuring an unused variable is harmless

- [x] 🟢 **[MapsTab.tsx]** `getStageMaps` helper is defined inside the component — identical logic exists in `BracketTab.tsx` (inline) and `api/maps/route.ts`
  - Fix: move to `lib/utils.ts` as `parseStageMaps(value)` and share across all three
  - Fixed: `parseStageMaps` lives in `lib/utils.ts`; `MapsTab`, `BracketTab`, and `api/maps/route.ts` all import and use it; the old inline `getStageMaps` wrapper in `MapsTab` delegates to it

- [-] 🟢 **[All components]** Inline `onMouseEnter`/`onMouseLeave` style mutations are used as a hover pattern throughout — fragile and verbose
  - Won't fix: Tailwind `hover:` variants can't reference CSS variables like `var(--accent-red)`, so a `HoverButton` wrapper would be needed — more effort than the cosmetic gain justifies

---

## 🔬 Re-Analysis — New Findings

### 🐛 Bugs

- [ ] 🔴 **[kv.ts]** `defaultState()` still has `adminPwHash: 'admin123'` as plaintext
  - On a fresh KV store (new deployment), the default password is written as plaintext, bypassing the hashing added in `auth/route.ts`
  - Fix: `defaultState()` should write an empty string or a pre-hashed sentinel; the first login flow should detect a missing/empty hash and set it properly, OR hash `'admin123'` at build time and embed the hash as the default

- [ ] 🟠 **[api/state/stream/route.ts]** SSE endpoint polls KV every 1.5s regardless of whether any client is connected or state has changed
  - Every open browser tab causes 1 KV read per 1.5s forever — with 10 spectators that's ~400 KV reads/min doing nothing useful
  - Fix: track last-sent state hash and only push when state actually changed; or use a shared in-process emitter so KV is polled once per interval regardless of client count

- [ ] 🟠 **[api/bracket/route.ts]** `PATCH` with score update re-runs `autoByes` on the entire bracket unconditionally after every score change
  - If a match in round 3 is updated, `autoByes` scans all rounds from scratch — it can accidentally overwrite manually-set players or trigger double-propagation in edge cases
  - Fix: only run `autoByes` on rounds affected by the current change (from `ri` forward), not the entire bracket

- [ ] 🟡 **[MapsTab.tsx]** `drawWheel` uses the string `'var(--bg-elevated)'` and `'var(--text-dim)'` directly inside a `<canvas>` context
  - Canvas `fillStyle` doesn't resolve CSS variables — it renders as black/transparent when the empty-map fallback is hit
  - Fix: read computed CSS variable values via `getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated')` before drawing

- [ ] 🟡 **[context.tsx]** `resetAll` does not clear `maps` from local state — only `players`, `roster`, `teams`, `bracket`, `stageMaps` are reset
  - After a reset, maps still appear in the UI until the next SSE push
  - Fix: add `setMaps([])` inside `resetAll` (or have `/api/reset` also wipe maps and return them)

- [ ] 🟡 **[api/players/route.ts]** Duplicate name check is case-insensitive on read but player names are stored with original casing
  - `"Alice"` and `"alice"` are treated as duplicates in the queue check, but if one slips through (e.g. via a direct API call), the roster and teams will have both
  - Fix: normalise name to trimmed original casing on write; the existing `.toLowerCase()` guard is correct but should also be applied to roster operations

- [ ] 🟢 **[TeamsTab.tsx]** `isVisible()` falls back to `true` when `revealCount === 0` AND `revealing === false` — this means on the very first render after `formTeams`, before the animation starts, all members flash visible for one frame
  - Fix: track a `hasRevealed` boolean ref that is set to `true` once `seedRevealOrder` runs; only show members when `hasRevealed && isVisible()` or when `!hasRevealed` (clean first load)

---

### 🔒 Security

- [ ] 🟠 **[api/admin/auth/route.ts]** No brute-force protection on `POST /api/admin/auth`
  - An attacker can call the login endpoint in a tight loop with password guesses — nothing throttles or locks them out
  - Fix: add IP-based rate limiting (e.g. Upstash Ratelimit) on the login route — stricter than the player queue limit (e.g. 5 attempts per minute per IP)

- [ ] 🟠 **[api/admin/auth/route.ts]** Token has no binding — any client that intercepts a token (e.g. via shared clipboard, logs) can use it from any origin
  - Fix: bind token to a User-Agent or IP fingerprint stored alongside `'valid'` in KV; verify on each `verifyAdminToken` call

- [ ] 🟡 **[All API routes]** No CORS headers set — a malicious third-party site could send credentialed requests to the API if the browser has a session
  - In practice low-risk since auth is token-based, but good hygiene
  - Fix: add `Access-Control-Allow-Origin` restricted to the deployment domain in a Next.js middleware or `next.config.ts`

- [ ] 🟡 **[api/players/route.ts]** `byAdmin` flag is accepted from the request body with no verification
  - Any unauthenticated user can `POST /api/players` with `{ name: 'x', byAdmin: true }` and their name gets the 👑 badge
  - Fix: ignore `byAdmin` from the body unless the request passes `verifyAdminToken`; otherwise force `byAdmin: false`

---

### ♻️ Redundancy / Consistency

- [ ] 🟡 **[api/state/route.ts + api/state/stream/route.ts]** Both routes independently destructure `adminPwHash` out of state before responding — the pattern is repeated in two places and `/api/reset` does the same
  - Fix: add a `safeState(s: ServerState): ClientState` helper to `kv.ts` that does the omission once; all three routes call it

- [ ] 🟡 **[context.tsx]** `adminHeaders` is a `useMemo` that rebuilds on every `adminToken` change — but it's used in every single API helper as a spread
  - If `adminToken` is `null`, the header object still includes `Content-Type` — meaning non-admin POST bodies go out with the right content type but no auth, which is correct, but the memo is also recreated unnecessarily when the token hasn't changed in practice
  - Fix: minor — convert to a plain getter function `getAdminHeaders()` or keep the memo but document clearly why it's a memo vs a ref

- [ ] 🟡 **[BracketTab.tsx]** `RoundSet` receives `stageMaps` as a prop drilled from `BracketDisplay` which gets it from `useTourney` — two levels of prop drilling for something already in context
  - Fix: call `useTourney()` directly in `RoundSet` (or `MatchCard`) instead of prop-drilling `stageMaps`

- [ ] 🟡 **[All route files]** Every route file imports `verifyAdminToken` directly from `@/app/api/admin/auth/route` — importing from a route file is an antipattern (couples route modules to each other)
  - Fix: move `verifyAdminToken`, `hashPassword`, `verifyPassword` out of `route.ts` into a dedicated `lib/auth.ts`; `auth/route.ts` imports from there

- [ ] 🟢 **[lib/kv.ts]** `updateState` always does a full read → transform → write cycle with no optimistic concurrency — two simultaneous requests can cause a lost-update race
  - e.g. two admins clicking score buttons at the same moment: both read the same state, one write clobbers the other
  - Fix: for KV, true transactions aren't available, but wrapping with a lightweight lock key (set NX with TTL) reduces the window; alternatively document the limitation

- [ ] 🟢 **[components/*.tsx]** Each tab component re-declares its own loading skeleton inline (different heights, different number of placeholder blocks, inconsistent opacity ramps)
  - Fix: extract a shared `<TabSkeleton />` component (already partially done in `PlayersTab` — `TabSkeleton` is defined there but not exported or shared with other tabs)

---

### 🚀 Enhancement

- [ ] 🟠 **[BracketTab.tsx]** Bracket is displayed as a horizontal scroll of columns with no visual connectors between matches
  - Teams advancing to the next round are shown by shared names, but there are no lines/arrows connecting match winners to their next match
  - Fix: draw SVG connector lines between match cards and their target slot in the next round (standard bracket tree visualization)

- [ ] 🟠 **[TeamsTab.tsx + api/teams/route.ts]** No way to manually move a player between teams after formation
  - Once teams are formed, the only option is a full reset — admin can't fix a single bad placement
  - Fix: add a drag-and-drop (or dropdown swap) UI for moving a player from one team to another; add `PATCH /api/teams` action `swapPlayer` that atomically moves a player between team member arrays

- [ ] 🟡 **[PlayersTab.tsx]** Queue has no cap — the admin must manually clear once teams are formed; players keep submitting names even after the roster is locked
  - Fix: add a "lock queue" toggle (admin only) that sets a KV flag; `POST /api/players` rejects new submissions when locked; UI shows a "Queue closed" message to non-admins

- [ ] 🟡 **[BracketTab.tsx]** Match format (BO1 vs BO3) is hardcoded to `'bo1'` in `buildSE` and `buildDE` — there's no UI to pick format per-round or globally before generation
  - Fix: add a format selector in the bracket control panel (Global BO1 / Global BO3 / Per-round) and pass it into `POST /api/bracket`

- [ ] 🟡 **[MapsTab.tsx]** No visual feedback when a map is dragged onto a stage slot — the drag highlight (`dragOverStage`/`dragOverSlot`) works, but there's no animation or confirmation flash after a successful drop
  - Fix: add a brief highlight/flash animation on the slot after a successful `assignStage` resolves

- [ ] 🟡 **[page.tsx]** No connection status indicator — if KV is down or the SSE stream drops and the polling fallback fails silently, the admin has no idea the UI is showing stale data
  - Fix: expose a `stale` or `lastUpdated` timestamp from context; show a subtle banner ("⚠ Connection lost — retrying…") when the last successful refresh is more than 10s ago

- [ ] 🟡 **[AdminModal.tsx]** No session expiry feedback — the 8h KV token TTL will silently expire mid-session and all admin actions will start returning 403 with no indication
  - Fix: detect 403 responses from admin API calls in context helpers and set `isAdmin(false)` + show a re-login prompt automatically

- [ ] 🟢 **[page.tsx]** No mobile navigation — the tab bar overflows on small screens with `overflow-x-auto` but there's no indication of hidden tabs (no fade edge, no swipe affordance)
  - Fix: add a fade-out gradient on the right edge of the tab bar to hint at horizontal scrollability

- [ ] 🟢 **[BracketTab.tsx]** Champion banner `animate-pulse-glow` runs indefinitely — distracting once the tournament has been over for a while
  - Fix: stop the animation after 10 seconds by toggling a CSS class or using `animation-iteration-count: 3`

- [ ] 🟢 **[MapsTab.tsx]** The wheel canvas is fixed at `260×260` — on large screens it looks small; on mobile it can overflow its container
  - Fix: make canvas size responsive using a `ResizeObserver` or `useEffect` that reads the container width and sets canvas dimensions accordingly

---

### 🧹 Code Quality / Types

- [ ] 🟡 **[lib/types.ts]** `TournamentState` kept as a deprecated alias but still actively used across all server-side files (`kv.ts`, route handlers)
  - Fix: do a find-and-replace across the codebase to replace all `TournamentState` usages with `ServerState`; remove the deprecated alias

- [ ] 🟡 **[api/bracket/route.ts]** `buildSE`, `buildDE`, `autoByes`, `seedLBDropIn`, `resolveWinner` are all defined in the route file — business logic mixed with HTTP handler code
  - Fix: move all bracket-building logic to `lib/bracket.ts`; the route file imports and calls them; easier to unit-test in isolation

- [ ] 🟡 **[api/teams/route.ts]** Team color assignment uses `TEAM_COLORS[i % TEAM_COLORS.length]` but `TEAM_COLORS` only has 8 colors — with 10+ teams (possible with 50+ roster players), colors repeat visibly
  - Fix: generate colors programmatically (HSL rotation) when team count exceeds `TEAM_COLORS.length`, or extend the palette

- [ ] 🟢 **[next.config.ts]** Config is empty (`{}`) — no meaningful options set
  - Fix: add `output: 'standalone'` for smaller Docker images if self-hosting ever becomes relevant; add `experimental.typedRoutes: true` for compile-time route type checking; document why it's intentionally minimal

- [ ] 🟢 **[lib/kv.ts]** `getState` swallows all errors silently and returns `defaultState()` — if KV is misconfigured or rate-limited, the app silently serves empty state with no log
  - Fix: log the error to `console.error` before returning default, so it appears in Vercel function logs

- [ ] 🟢 **[All components]** No `displayName` set on any component — React DevTools shows anonymous components, making debugging harder
  - Fix: add `ComponentName.displayName = 'ComponentName'` for non-exported inner components (`PlayerRow`, `ScoreControls`, `RoundSet`, `MatchCard`, etc.)



