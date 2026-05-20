# Tournament Management — Task Tracker

> Legend: `[ ]` todo · `[x]` done · `[-]` skipped/won't fix
> Priority: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low

---

## 🐛 Bug Fixes

- [x] 🔴 **[context.tsx + AdminModal.tsx]** Admin token never stored in context — `assignLeader` always 403
  - Token was trapped in `AdminModal` local state, never passed to `adminHeaders`
  - Fixed: exposed `setAdminToken` on context, called it from `AdminModal` on login

- [ ] 🔴 **[kv.ts]** `adminPwHash` stored as plaintext — password is `"admin123"` in `defaultState()`
  - Anyone who reads the KV store sees the password directly
  - Fix: hash with `bcrypt` or `crypto.scrypt` on write, compare on verify

- [ ] 🔴 **[api/admin/auth/route.ts]** In-memory token store (`validTokens`) is lost on server restart / redeployment
  - On Vercel, serverless functions spin up fresh — all tokens are wiped, forcing re-login silently
  - Fix: store tokens in Vercel KV with TTL (e.g. 8h), or use JWT so no server-side store is needed

- [ ] 🟠 **[api/teams/route.ts]** Team formation (`POST`) has no auth check for the main creation path
  - Any unauthenticated client can call `POST /api/teams` and regenerate teams
  - Fix: add `authorizeAdmin` check at the top of `POST`, before the `assignments` branch split

- [ ] 🟠 **[api/players/route.ts]** `addToRoster` has no auth check — any user can add themselves to the roster
  - The UI hides the button for non-admins but the API is wide open
  - Fix: require admin token for `addToRoster`, `removeFromRoster`, `setRoster`, `clearQueue`, `clearRoster`

- [ ] 🟠 **[api/bracket/route.ts]** Score updates (`PATCH`) have no auth check
  - Any client can call `PATCH /api/bracket` and change scores
  - Fix: add `authorizeAdmin` check on `PATCH`, `PUT`, `DELETE`

- [ ] 🟠 **[api/maps/route.ts]** Map add/delete/assign has no auth check
  - Fix: protect `POST`, `DELETE`, `PATCH` with admin token verification

- [ ] 🟠 **[api/reset/route.ts]** `DELETE /api/reset` has no auth check — anyone can wipe the tournament
  - Fix: add `authorizeAdmin` check

- [ ] 🟡 **[api/bracket/route.ts]** Double elimination lower bracket logic is incomplete
  - Losers are dropped into `lower_r{ri*2}` but there's no logic to build consolidation rounds (LB winner advancing, alternating rounds)
  - The lower bracket grows uncontrolled and doesn't properly produce a single LB finalist
  - Fix: implement full double-elim bracket builder (seeding losers, alternating bye rounds, LB final → GF)

- [ ] 🟡 **[TeamsTab.tsx]** Reveal animation `revealOrderMap` is recomputed every time `teams` reference changes (polling every 4s)
  - `useMemo` depends on `teams` — each poll replaces the array reference, reshuffling the reveal order for members not yet visible
  - Fix: seed the map once on `formTeams` success and store it in a `useRef`, not `useMemo`

- [ ] 🟡 **[context.tsx]** `setElimMode` is client-side only — does NOT persist to KV
  - The `PATCH /api/bracket` with `action: 'setElimMode'` exists in the route but `context.tsx` never calls it
  - After a page refresh, `elimMode` reverts to whatever is stored (default `'single'`)
  - Fix: make `setElimMode` async, call `PATCH /api/bracket` with `{ action: 'setElimMode', elimMode }`

- [ ] 🟡 **[MapsTab.tsx]** Wheel pointer (▶) is positioned above the canvas with `rotate-90` but its alignment is purely visual/approximate — the math in `spin()` normalises angle from 12 o'clock (top), not 3 o'clock (right)
  - The picked map can be off by one slice in certain angle ranges
  - Fix: align pointer to the right (3 o'clock, angle 0) or adjust the normalisation formula to match pointer position

- [ ] 🟢 **[PlayersTab.tsx]** Drag-and-drop `dragging` state is set via `handleDragStart` but never cleared on `dragend`
  - If the user drags and drops outside a valid target, `dragging` stays set
  - Fix: add `onDragEnd` handler to clear `setDragging(null)` on both queue items and roster items

---

## 🔒 Security

- [ ] 🔴 **[kv.ts]** Hash the admin password — see Bug Fixes above

- [ ] 🟠 **[All API routes]** Add auth middleware — see Bug Fixes above (teams, players, bracket, maps, reset)

- [ ] 🟡 **[api/players/route.ts]** No rate limit on `POST /api/players` — anyone can spam the queue with fake names
  - Fix: add IP-based rate limiting (e.g. Vercel Edge middleware, or upstash ratelimit library)

- [ ] 🟡 **[api/players/route.ts]** Player name has no server-side max-length check (only `maxLength={24}` in the UI)
  - Fix: validate `trimmed.length <= 24` in the POST handler

---

## ♻️ Redundancy / Consistency

- [ ] 🟡 **[lib/utils.ts]** `TEAM_COLORS` and `WHEEL_COLORS` are identical arrays — only `WHEEL_COLORS` has two extra entries
  - `TEAM_COLORS` is used for team card borders; `WHEEL_COLORS` for the spin wheel
  - Fix: define one `BASE_COLORS` array, then `WHEEL_COLORS = [...BASE_COLORS, '#78c6ff', '#ffd966']`

- [ ] 🟡 **[MapsTab.tsx + api/maps/route.ts]** `stageMaps` value type inconsistency — stored as `string[]` in KV but cast with `as unknown as string` in many places
  - The type in `types.ts` is `Record<string, string[]>` but old KV data may have scalar strings
  - Fix: normalise all reads through a single `getStageMaps(key)` helper (already partially done in `MapsTab`) and remove the `as unknown as` casts everywhere by ensuring KV always writes arrays

- [ ] 🟡 **[BracketTab.tsx]** `MatchCard` and `GrandFinalDisplay` render nearly identical JSX (player rows, BO3 score buttons, BO1 winner buttons)
  - Fix: extract a shared `PlayerRow` component and a `ScoreControls` component used by both

- [ ] 🟡 **[BracketTab.tsx]** `ThirdPlaceDisplay` duplicates the player row render logic from `MatchCard`
  - Fix: same as above — share `PlayerRow` / `ScoreControls`

- [ ] 🟡 **[context.tsx]** `removeSpunMap` is just an alias for `removeMap` — exported separately but identical
  - Fix: remove `removeSpunMap` from context interface and just call `removeMap` directly in `MapsTab`

- [ ] 🟢 **[page.tsx]** Dark mode stored in `useState` — resets to light on every page refresh
  - Fix: persist preference to `localStorage` and initialise from it (with a `useEffect` to avoid SSR mismatch)

- [ ] 🟢 **[AdminModal.tsx]** `sessionToken` local state in `AdminModal` is now redundant — `adminToken` in context holds the same value
  - Fix: remove `sessionToken` local state; read `adminToken` from context (needs context to expose it as readable value)

---

## 🚀 Enhancement

- [ ] 🟠 **[context.tsx]** Polling every 4s with a full `/api/state` fetch is wasteful — every spectator and admin hammers the KV store
  - Fix: replace with Server-Sent Events (SSE) or long-polling so the server pushes updates only when state actually changes

- [ ] 🟠 **[api/teams/route.ts + context.tsx]** No optimistic update on `formTeams` — UI shows stale teams until the next poll after a reset+reform cycle
  - Fix: return and immediately apply the new teams from the `formTeams` API response (already done), but also clear `bracket` optimistically in context

- [ ] 🟡 **[TeamsTab.tsx]** In Fully Random mode, the `✓` assign-leader button shows on every member
  - After assigning a leader, the button disappears for that person but remains on all others — clicking a second member replaces the first leader silently
  - Enhancement: show a subtle "change" indicator on the current leader instead of just hiding the button, so admin knows reassignment is possible

- [ ] 🟡 **[BracketTab.tsx]** No way to undo/revert a score once set — the match is locked with no reset option
  - Fix: add a small ✕ / undo button on completed matches (admin only) that clears `winner`, `score1`, `score2` and re-propagates

- [ ] 🟡 **[PlayersTab.tsx]** Admin can add players via the same queue form as regular users (`byAdmin` flag exists but there's no dedicated "add as admin" UI path)
  - Fix: add a separate "Add by Admin" input or a toggle on the submit button so admin-added players get the `byAdmin: true` flag and the 👑 badge

- [ ] 🟡 **[MapsTab.tsx]** Spun map result (`spunMap`) resets on page refresh — no persistence
  - If the admin spins and then changes tabs, the result is gone
  - Fix: store last spun map in context (or at least component-level across tab switches via `useState` lifted to page)

- [ ] 🟢 **[layout.tsx]** Google Fonts loaded via `<link>` in `<head>` — causes render-blocking and a console warning in Next.js 14+
  - Fix: use `next/font/google` for `Bebas_Neue`, `DM_Mono`, and `Syne` instead

- [ ] 🟢 **[page.tsx]** Player count badge on the Players tab only counts the queue (`players.length`), not the roster
  - Could be confusing — a player in the roster is no longer a pending queue item
  - Fix: show separate indicators or change badge to show roster count when it differs

- [ ] 🟢 **[TeamsTab.tsx]** No feedback when `formTeams` is in-flight — the "Form Teams" button has no loading state
  - Fix: add a `forming` boolean state, disable + show spinner on the button while awaiting the API

- [ ] 🟢 **[globals.css]** `t-header` utility uses `--header-bg` but the class is only used once (in `page.tsx`) — could just be an inline style or a direct Tailwind arbitrary value
  - Minor: not worth changing unless doing a CSS cleanup pass

---

## 🧹 Code Quality / Types

- [ ] 🟡 **[lib/types.ts]** `TournamentState.adminPwHash` should never leave the server but the type is shared client/server
  - Fix: split into `ServerState` (with `adminPwHash`) and `ClientState` (without), use `ClientState` on the frontend

- [ ] 🟡 **[api/bracket/route.ts]** `autoByes` mutates its input array directly — side-effectful and hard to test
  - Fix: return a new array / make it a pure function

- [ ] 🟡 **[context.tsx]** `useTourney` hook has no loading guard — components that call it during initial load may render with empty arrays before `refresh()` completes
  - `loading` is exposed but most tab components don't check it
  - Fix: each tab should return a skeleton/spinner if `loading === true`

- [ ] 🟢 **[api/teams/route.ts]** `teamMode` read from POST body but the route also sets it — if `assignments` branch fires, the `teamMode` from body is ignored but the variable is still destructured
  - Minor: destructure only what's needed per branch for clarity

- [ ] 🟢 **[MapsTab.tsx]** `getStageMaps` helper is defined inside the component — identical logic exists in `BracketTab.tsx` (inline) and `api/maps/route.ts`
  - Fix: move to `lib/utils.ts` as `parseStageMaps(value)` and share across all three

- [ ] 🟢 **[All components]** Inline `onMouseEnter`/`onMouseLeave` style mutations are used as a hover pattern throughout — fragile and verbose
  - Fix: use Tailwind `hover:` variants or a small `HoverButton` wrapper component

