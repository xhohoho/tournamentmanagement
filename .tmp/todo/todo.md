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

- [ ] 🟢 **[globals.css]** `t-header` utility uses `--header-bg` but the class is only used once (in `page.tsx`) — could just be an inline style or a direct Tailwind arbitrary value
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

