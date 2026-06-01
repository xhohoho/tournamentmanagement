# Tournament Management — Refactor Task Tracker

> Legend: `[ ]` todo · `[x]` done · `[-]` skipped/won't fix
> Priority: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low
> Source: Full codebase analysis — June 2026

---

## 🏗️ Architecture / Structure

- [ ] 🔴 **[app/api/admin/auth/route.ts → lib/auth.ts]** `verifyAdminToken`, `hashPassword`, `verifyPassword`, `isAdminTokenValid` are defined inside a route file and imported by every other route
  - Importing from a route file is an antipattern — couples route modules, risks circular imports, leaks route-level side effects
  - Fix: move all four helpers into `lib/auth.ts` (currently only `canAccessTournament` lives there); update every importer (`tournamentAccess.ts`, `bracket/route.ts`, `tournaments/route.ts`) to import from `lib/auth`

- [ ] 🔴 **[app/api/bracket/route.ts → lib/bracket.ts]** All bracket business logic (`buildSE`, `buildDE`, `seedLBDropIn`, `sweepBracket`, `isFeederResolved`, `stageFormat`, `emptyMatch`, `resolveWinner`) lives in the route file — ~350 lines of pure logic mixed with HTTP handlers
  - Fix: extract everything above into `lib/bracket.ts`; the route file becomes thin HTTP glue (parse request → call lib → return JSON)
  - Bonus: these functions can then be unit-tested in isolation

- [ ] 🟠 **[lib/tournamentAccess.ts]** Still imports `verifyAdminToken` from `@/app/api/admin/auth/route` — blocked until the auth helpers are moved to `lib/auth.ts`
  - Fix: update import after the above is resolved

- [ ] 🟠 **[lib/types.ts]** `TournamentState` is kept as a deprecated alias (`= ServerState`) but is still actively used in `kv.ts` and many route handlers
  - Fix: global find-and-replace `TournamentState` → `ServerState` across the entire codebase; remove the deprecated alias from `types.ts`

- [ ] 🟡 **[app/api/state/route.ts + app/api/state/stream/route.ts + app/api/reset/route.ts]** All three independently destructure `adminPwHash` out of state before responding — `const { adminPwHash: _, ...safe } = state`
  - Fix: add a `safeState(s: ServerState): ClientState` helper in `lib/kv.ts` that does the omission once; all three routes call it instead of duplicating the destructure

- [ ] 🟡 **[app/api/ffa/route.ts]** `GET` handler does a lazy dynamic import `const { getState } = await import('@/lib/kv')` — the only route that does this; all others import at the top
  - Fix: move `import { getState } from '@/lib/kv'` to the top of the file (static import)

---

## ♻️ Redundancy / Consistency

- [ ] 🟠 **[lib/context.tsx]** `adminHeaders` `useMemo` is fine, but it does NOT include `adminToken` in non-admin POST bodies — that's correct — yet the memo rebuilds on every token change including `null → null` equality. The real issue is that every single API helper in context spreads `adminHeaders` and manually adds `body: JSON.stringify(...)`, repeating the same fetch boilerplate ~30 times
  - Fix: extract a small internal `apiFetch(path, method, body?, admin?)` helper inside the provider that handles `Content-Type`, optional `X-Admin-Token`, and `?t=` param injection; cut ~40% of the boilerplate in context

- [ ] 🟠 **[lib/context.tsx]** Every roster/player/teams/bracket mutating function calls `guard.touch(field)` manually before the fetch, with inconsistent field names (e.g. `'players'` vs `'chat'` vs `'spinCategories'`) — easy to miss a guard or touch the wrong field
  - Fix: standardise guard field names as a TypeScript `const` enum or string union at the top of context; add a helper `touchGuards(...fields: GuardField[])` to batch them

- [ ] 🟡 **[app/api/bracket/route.ts]** `PATCH` handler has two separate code paths that both do `await getState(tid)` + `const bracket: Bracket = JSON.parse(JSON.stringify(B))` — once for `undoMatch`, once for score updates. The deep-clone pattern is repeated 3 times in the same file
  - Fix: extract `cloneBracket(b: Bracket): Bracket` as a one-liner util in `lib/bracket.ts`

- [ ] 🟡 **[app/api/bracket/route.ts]** Winner propagation logic for `upper` rounds (same slot math: `Math.floor(mi/2)`, even/odd assignment) is copy-pasted in both the `PATCH` score update path AND the `undoMatch` path
  - Fix: extract `propagateWinner(rounds, ri, mi, winner)` and `clearWinner(rounds, ri, mi, prevWinner)` helpers in `lib/bracket.ts`

- [ ] 🟡 **[app/api/maps/route.ts + lib/context.tsx]** `spinQueue` is updated three different ways: `updateSpinQueue` (full replace), `appendSpinQueue` (push one), and `clearSpinQueue` (set to `[]`) in context — but the API only has `updateSpinQueue` and `appendSpinQueue`; `clearSpinQueue` in context calls `updateSpinQueue` with `[]`
  - Inconsistency: `removeSpinQueueItem` in context builds the new array client-side and fires `updateSpinQueue` without waiting for the response (fire-and-forget inside `setSpinQueue`)
  - Fix: make `removeSpinQueueItem` await the response; or add a dedicated `removeSpinQueueItem` action on the API for atomicity

- [ ] 🟡 **[app/page.tsx]** Ticker edit modal is ~40 lines of inline JSX inside `MainApp` — a one-off modal that shares the same pattern as other modals in the codebase
  - Fix: extract `<TickerEditModal open onClose onSave />` component (similar to `DeleteConfirmModal`)

- [ ] 🟡 **[app/page.tsx]** `pickerAdminToken` and `pickerAdminInfo` state in the root `Home` component duplicates what `useAdminSession` hook already manages — the hook reads from `localStorage` on init, but the page component also reads from `localStorage` in a `useEffect` and stores it in separate state
  - Fix: use `useAdminSession()` directly in `Home` and pass its values to `TourneyProvider`; remove the duplicate `useEffect` + `setPickerAdminToken`/`setPickerAdminInfo` state

- [ ] 🟡 **[hooks/useTournaments.ts]** Duplicates the SSE-with-polling-fallback connection pattern that already exists in `lib/context.tsx` — same structure, different endpoint
  - Fix: extract a generic `useSSE<T>(url: string, onData: (d: T) => void, pollInterval?: number)` hook into `hooks/useSSE.ts`; both `useTournaments` and the context `useEffect` use it

- [ ] 🟢 **[app/api/maps/route.ts]** `DELETE` handler removes a map from `maps` array but does NOT clean up `stageMaps` — if the deleted map is assigned to a stage, it persists as a ghost value until the stage is manually cleared
  - Fix: also filter `stageMaps` values in the `DELETE` updater, removing the map name from all stage arrays

- [ ] 🟢 **[app/api/teams/route.ts]** `POST` handler reads `teamMode` from `body` but if the `assignments` branch fires (leader assignment), `teamMode` is destructured but never used — `state.teamMode` is used implicitly
  - Fix: only destructure `teamMode` outside the `assignments` branch (minor cleanup)

---

## 🔒 Security (Remaining)

- [ ] 🔴 **[app/api/admin/auth/route.ts]** No brute-force protection on `POST /api/admin/auth` — unlimited password guesses from any IP
  - Fix: integrate Upstash Ratelimit (already a transitive dep via `@vercel/kv`): 5 attempts per minute per IP; return `429` with a `Retry-After` header on breach

- [ ] 🟠 **[app/api/players/route.ts]** `byAdmin` flag is not in the current POST handler (already stripped from the code), but there is no server-side assertion that ensures a non-admin cannot inject admin-level fields through the request body
  - Fix: explicitly whitelist only `{ name, joinKey }` from the POST body; reject or ignore any extra keys

- [ ] 🟠 **[app/api/admin/auth/route.ts]** Token has no binding to the requester — any client that intercepts a token can use it from any origin/IP/device
  - Fix: store a User-Agent or IP fingerprint alongside the token in KV; verify fingerprint on each `verifyAdminToken` call; return 403 if mismatched

- [ ] 🟡 **[All API routes]** No CORS headers — a third-party site could send credentialed requests if the browser has a session
  - Fix: add `Access-Control-Allow-Origin: <deployment-domain>` in `next.config.ts` headers or a middleware; restrict to the Vercel deployment domain

- [ ] 🟡 **[app/api/players/route.ts]** Duplicate name check is case-insensitive (`toLowerCase`) in the queue but roster operations don't normalise — `"Alice"` and `"alice"` could both end up in the roster via direct API calls
  - Fix: also apply `toLowerCase` guard to `addToRoster`; normalise on write to the queue as well

---

## 🐛 Bug Fixes (Remaining)

- [ ] 🔴 **[lib/kv.ts]** `defaultState()` has no `adminPwHash` field at all (good), but a fresh KV store gets the raw `defaultState()` on first `getState` — if code anywhere still reads `state.adminPwHash`, it will be `undefined`, which is fine; but the todo note from the old list remains: verify no code path can accidentally write a plaintext password as the default
  - Fix: add a runtime assertion in `ensureDefaultAdmin` (in `auth/route.ts`) that checks the written `pwHash` contains `:` (i.e. is hashed) before saving

- [ ] 🔴 **[app/api/state/stream/route.ts + context.tsx]** Admin updates are NOT appearing in real-time for spectators — the SSE stream polls KV every 1.5s regardless of whether the state changed, causing both wasteful reads AND delayed updates (up to 1.5s lag)
  - Root fix: track a `lastSentHash` (MD5 or `JSON.stringify` hash) per SSE connection; only push when the hash changes; this also solves the KV spam issue from the old todo

- [ ] 🟠 **[app/api/bracket/route.ts]** `PATCH` score update calls `sweepBracket` on the entire bracket unconditionally after every score change — can accidentally trigger double-propagation or overwrite manually-set slots in edge cases
  - Fix: only call `sweepBracket` starting from the round affected by the current change (`ri` forward), not from round 0

- [ ] 🟠 **[app/api/players/route.ts]** `POST` does a `getState` → check duplicate → `updateState` in two separate KV calls — a race condition exists where two players with the same name can submit simultaneously, both pass the duplicate check, and both get added
  - Fix: move the duplicate check inside the `updateState` updater function so it runs atomically with the write

- [ ] 🟡 **[MapsTab.tsx]** `drawWheel` uses `'var(--bg-elevated)'` and `'var(--text-dim)'` as `fillStyle` — canvas does not resolve CSS variables, renders black/transparent
  - Fix: `getComputedStyle(document.documentElement).getPropertyValue('--bg-elevated').trim()` before drawing

- [ ] 🟡 **[lib/context.tsx]** `resetAll` does not reset `maps` local state — maps remain visible in the UI until the next SSE push after reset
  - Fix: add `setMaps([])` inside `resetAll` (or have `/api/reset` also wipe maps from the response and apply it)

- [ ] 🟡 **[TeamsTab.tsx]** `isVisible()` falls back to `true` when `revealCount === 0` AND `revealing === false` — on first render after `formTeams`, before animation starts, all members flash visible for one frame
  - Fix: track a `hasRevealed` ref; only show members when `hasRevealed && isVisible()` or `!hasRevealed` (clean first load before any formation)

- [ ] 🟢 **[lib/kv.ts]** `getState` swallows all errors silently and returns `defaultState()` — if KV is misconfigured or rate-limited, the app silently serves empty state with no log
  - Fix: `console.error(err)` before returning default so errors appear in Vercel function logs

---

## 🔁 Code Quality / Types

- [ ] 🟠 **[app/api/bracket/route.ts + POST handler]** `action === 'generate'` duplicates the SE round-building loop from `buildSE` — the same `emptyMatch` + round array construction is written out inline a second time instead of calling `buildSE` with empty team names
  - Fix: call `buildSE(Array(state.teams.length).fill(''), sf)` and clear p1/p2 afterward, as is already done for the DE path; remove the duplicate loop

- [ ] 🟡 **[app/api/teams/route.ts]** Team color assignment uses `TEAM_COLORS[i % TEAM_COLORS.length]` — with 10+ teams (≥50 roster players), colors repeat visibly since `TEAM_COLORS` only has 8 entries
  - Fix: generate HSL colors dynamically when team count exceeds palette length: `hsl(${(i * 360 / n) % 360}, 70%, 55%)`

- [ ] 🟡 **[lib/context.tsx]** `TourneyContext` interface is defined inline in `context.tsx` — it's large (~60 properties) and duplicates some types from `lib/types.ts`
  - Fix: move `TourneyContext` to `lib/types.ts` (or a new `lib/context-types.ts`) so it can be imported cleanly by any component that needs to reference it

- [ ] 🟡 **[All components]** No `displayName` on inner/anonymous components — React DevTools shows them as `Anonymous`
  - Affected: `PlayerRow`, `ScoreControls`, `RoundSet`, `MatchCard`, `GrandFinalDisplay`, `ThirdPlaceDisplay` in `BracketTab`; `TabSkeleton` in `PlayersTab`
  - Fix: add `ComponentName.displayName = 'ComponentName'` after each inner component definition

- [ ] 🟡 **[app/api/maps/route.ts]** `PATCH` action `updateSpinState` exists in the route but there is no corresponding context method that calls it — the spin state is set from `picker-ticker` route instead
  - Fix: either remove the dead `updateSpinState` action from maps route, or wire it up; document where spin state is actually set

- [ ] 🟢 **[next.config.ts]** Config is empty `{}` — no options documented
  - Fix: add `experimental: { typedRoutes: true }` for compile-time route checking; add a comment explaining why it's intentionally minimal; consider `output: 'standalone'` for self-hosting

- [ ] 🟢 **[All components]** Inline `onMouseEnter`/`onMouseLeave` style mutations used as hover pattern throughout — fragile and verbose, but Tailwind `hover:` can't reference CSS variables like `var(--accent-red)`
  - Fix: create a `<HoverButton>` wrapper that accepts `hoverColor` prop and handles the style swap internally, replacing all the inline handlers

- [ ] 🟢 **[lib/kv.ts]** `updateState` uses an optimistic concurrency Lua script with 5 retries — the retry backoff is `10 + random * 40 * (attempt+1)` ms, which is fine, but there's no logging on retry or final fallback
  - Fix: `console.warn('[kv] updateState retry', attempt)` inside the loop; `console.error('[kv] updateState fallback after 5 retries')` before the fallback write

---

## 🎨 UX / Design (Prioritised)

### Global

- [ ] 🔴 **[All tabs]** Each tab must fit within one viewport — no vertical page scroll
  - `PlayersTab`, `BracketTab`, `MapsTab` currently overflow on 1080p
  - Fix: redesign each tab with `height: 100%` CSS grid; internal sub-panels scroll within fixed containers; tab chrome and controls always visible

- [ ] 🔴 **[context.tsx + api/state/stream/route.ts]** Admin updates do not appear in real-time for spectators (see Bug Fix above for root cause)
  - UX manifestation: spectators see stale bracket/player/team data until SSE pushes (up to 1.5s) or until they manually refresh

### Players Tab

- [ ] 🟠 **[PlayersTab.tsx]** Remove `byAdmin` badge (👑) and any role text from player list items — not needed in UI
- [ ] 🟠 **[PlayersTab.tsx]** Remove the "Add as Admin" toggle button — confusing and unused in practice
- [ ] 🟠 **[PlayersTab.tsx]** Input not disabled synchronously on submit — characters can be entered during the async window
  - Fix: `setSubmitting(true)` before `await`, not after; clear and re-enable only after API resolves
- [ ] 🟠 **[PlayersTab.tsx + api/players/route.ts]** Admin cannot rename/replace a player mid-tournament
  - Fix: inline edit (pencil icon) on each player row (admin only); new `PATCH /api/players` action `renamePlater` updates name in `players`, `roster`, and `teams` atomically

### Bracket Tab

- [ ] 🔴 **[BracketTab.tsx + api/bracket/route.ts]** Add BO1/BO3 format selector before bracket generation (per-stage: Group / Semi / Grand Final)
  - Already partially implemented in types and API; missing is a UI selector in the bracket control panel that calls the existing `saveFormats` action before `generate`

- [ ] 🔴 **[BracketTab.tsx]** Replace "Waiting for admin to generate the bracket." with ghost bracket previews
  - Show two previews (SE and DE) using current team count with placeholder slot names; updates reactively as teams change

- [ ] 🔴 **[BracketTab.tsx + api/bracket/route.ts]** Add shuffle/seeding step between team formation and bracket generation
  - Already implemented (`action: 'seed'` exists); missing: the UI to show a "Seed Bracket" button that triggers the animation before "Generate"

- [ ] 🟠 **[BracketTab.tsx]** No SVG connector lines between match rounds — teams advancing are only traceable by name, not visually
  - Fix: draw SVG polylines from each match card's right edge to the target match card's left edge in the next round

- [ ] 🟠 **[BracketTab.tsx + api/bracket/route.ts]** Score input is a winner-click, not a numeric stepper — admin must click the team name to advance, rather than entering actual scores
  - Fix: +/− stepper buttons for each side; system auto-advances when win condition is met (BO1 = first to 1, BO3 = first to 2)

### Teams Tab

- [ ] 🟡 **[TeamsTab.tsx]** Review admin vs. non-admin UI layout — ensure formation controls are visually grouped and separated from read-only team cards

### Maps Tab

- [ ] 🔴 **[MapsTab.tsx + api/maps/route.ts]** Rework spin flow: landed map should be removed from the wheel pool (marked as "used"), not removed from the master list
  - New flow: spin → result → move to `usedMaps` in KV → wheel shows only remaining maps
  - "Restore All Maps" button: moves `usedMaps` back into active pool without touching the master list

- [ ] 🟠 **[MapsTab.tsx]** Show "Current Round Map" prominently after spin; accumulate `mapHistory` in KV for full round sequence visibility

- [ ] 🟡 **[MapsTab.tsx]** No visual feedback (animation/flash) when a map is dropped onto a stage slot after a successful `assignStage`

---

## 🚀 Enhancement (Remaining)

- [ ] 🟠 **[BracketTab.tsx]** No SVG connector lines — see UX section above

- [ ] 🟠 **[TeamsTab.tsx + api/teams/route.ts]** No way to move a player between teams after formation — full reset is the only option
  - Fix: drag-and-drop or dropdown swap UI; new `PATCH /api/teams` action `swapPlayer` atomically moves a player between team member arrays

- [ ] 🟡 **[PlayersTab.tsx]** No queue cap — players can keep submitting even after teams are formed/roster locked
  - Fix: "lock queue" toggle (admin only) sets a KV flag; `POST /api/players` rejects when locked; UI shows "Queue closed" to non-admins

- [ ] 🟡 **[page.tsx]** No connection status indicator — if SSE drops and polling fails, UI silently shows stale data
  - Fix: expose `lastUpdated` timestamp from context; show a banner "⚠ Connection lost — retrying…" when last refresh is >10s ago

- [ ] 🟡 **[AdminModal.tsx]** No session expiry feedback — 8h token TTL expires silently; admin actions return 403 with no prompt to re-login
  - Fix: detect 403 from admin API calls in context helpers; call `setIsAdmin(false)` and show a re-login prompt

- [ ] 🟢 **[page.tsx]** Tab bar has no scroll affordance on mobile — no fade edge, no swipe hint
  - Fix: add a right-edge gradient fade on the tab bar to hint at horizontal scrollability

- [ ] 🟢 **[BracketTab.tsx]** Champion banner `animate-pulse-glow` runs indefinitely
  - Fix: stop after 10s via `animation-iteration-count` or a timeout that removes the class

- [ ] 🟢 **[MapsTab.tsx]** Wheel canvas fixed at `260×260` — small on large screens, overflows on mobile
  - Fix: responsive canvas size via `ResizeObserver` reading container width
