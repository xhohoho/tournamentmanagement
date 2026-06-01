# Tournament Management — Refactor Task Tracker

> Legend: `[ ]` todo · `[x]` done · `[-]` skipped/won't fix
> Priority: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low
> Source: Full codebase analysis — June 2026

---

## 🏗️ Architecture / Structure

- [x] 🔴 **[app/api/admin/auth/route.ts → lib/auth.ts]** Auth helpers extracted to `lib/auth.ts`.

- [x] 🔴 **[app/api/bracket/route.ts → lib/bracket.ts]** Bracket logic extracted to `lib/bracket.ts`.

- [x] 🟠 **[lib/tournamentAccess.ts]** Import updated to `lib/auth`.

- [x] 🟠 **[lib/types.ts]** `TournamentState` alias replaced with `ServerState` everywhere.

- [x] 🟡 **[lib/kv.ts]** `safeState()` helper added; all routes use it.

- [x] 🟡 **[app/api/ffa/route.ts]** Lazy dynamic import fixed.

---

## ♻️ Redundancy / Consistency

- [x] 🟠 **[lib/context.tsx]** `apiFetch` helper not extracted — ~30 fetch calls repeat Content-Type + auth header boilerplate.

- [ ] 🟠 **[lib/context.tsx]** Guard field names not standardised as a const union/enum.

- [ ] 🟡 **[app/api/bracket/route.ts]** `cloneBracket` not yet extracted to `lib/bracket.ts`.

- [ ] 🟡 **[app/api/bracket/route.ts]** `propagateWinner` / `clearWinner` not yet extracted.

- [ ] 🟡 **[app/api/maps/route.ts + lib/context.tsx]** `removeSpinQueueItem` still fire-and-forget.

- [x] 🟡 **[app/page.tsx]** `<TickerEditModal>` extracted with `displayName`.

- [x] 🟡 **[app/page.tsx]** Admin state deduplicated via `useAdminSession()`.

- [x] 🟢 **[app/api/maps/route.ts]** `DELETE` cleans ghost `stageMaps` references.

- [x] 🟢 **[app/api/teams/route.ts]** Unused `teamMode` destructure removed.

---

## 🔒 Security (Remaining)

- [x] 🔴 **[app/api/admin/auth/route.ts]** No brute-force protection — sliding-window rate limiter: 5 req/60s/IP via `@vercel/kv`, returns `429` + `Retry-After`. Counter cleared on successful login.

- [x] 🟠 **[app/api/players/route.ts]** POST body whitelists only `{ name, joinKey }`.

- [ ] 🟠 **[app/api/admin/auth/route.ts]** Token has no IP/origin binding.

- [ ] 🟡 **[All API routes]** No CORS headers.

- [x] 🟡 **[app/api/players/route.ts]** Case-insensitive dedup applied consistently.

---

## 🐛 Bug Fixes (Remaining)

- [x] 🔴 **[lib/kv.ts]** `ensureDefaultAdmin` — assert `pwHash` contains `:` before saving. (`ensureDefaultAdmin` no longer exists; guard is in `saveAdminAccount`)

- [x] 🔴 **[app/api/state/stream/route.ts]** SSE hash dedup — only pushes on state change.

- [x] 🟠 **[app/api/bracket/route.ts]** `sweepBracket` called unconditionally — should start from affected round `ri`.

- [x] 🟠 **[app/api/players/route.ts]** Duplicate name check moved inside `updateState` — atomic.

- [x] 🟡 **[MapsTab.tsx]** `drawWheel` uses CSS var as canvas `fillStyle` — needs `getComputedStyle`.

- [-] 🟡 **[lib/context.tsx]** `resetAll` doesn't reset `maps` local state. (intentional — maps persist across round resets; comment added in context.tsx)

- [ ] 🟡 **[TeamsTab.tsx]** `isVisible()` flash on first render after `formTeams`.

- [x] 🟢 **[lib/kv.ts]** `getState`/`listTournaments`/`updateState` error logging added.

---

## 🔁 Code Quality / Types

- [x] 🟠 **[app/api/bracket/route.ts]** `action === 'generate'` duplicates SE loop instead of calling `buildSE`. (resolved by buildEmptySE/buildEmptyDE delegation)

- [x] 🟡 **[app/api/teams/route.ts]** HSL color generation for >8 teams.

- [ ] 🟡 **[lib/context.tsx]** `TourneyContext` interface still inline — move to `lib/types.ts`.

- [ ] 🟡 **[All components]** Missing `displayName` on anonymous components.

- [ ] 🟡 **[app/api/maps/route.ts]** Dead `updateSpinState` action.

- [ ] 🟢 **[next.config.ts]** Add `typedRoutes`, `output: 'standalone'`.

- [ ] 🟢 **[All components]** Extract `<HoverButton>` wrapper.

- [x] 🟢 **[lib/kv.ts]** `updateState` retry/fallback logging.

---

## 🎨 UX / Design (Prioritised)

### Global

- [ ] 🔴 **[All tabs]** Each tab must fit one viewport — `PlayersTab`, `BracketTab`, `MapsTab` overflow on 1080p.

- [x] 🔴 **[context.tsx + api/state/stream/route.ts]** SSE hash dedup — real-time spectator updates.

### Players Tab

- [x] 🟠 **[PlayersTab.tsx]** `byAdmin` badge / role text — `Player` type has no such field; never rendered.
- [x] 🟠 **[PlayersTab.tsx]** "Add as Admin" toggle — not present in component.
- [x] 🟠 **[PlayersTab.tsx]** Input disabled synchronously on submit — `disabled={submitting}` + `submitLock` ref + immediate clear already handles this.
- [x] 🟠 **[PlayersTab.tsx + api/players/route.ts]** `renamePlayer` action added — atomic across `players`, `roster`, `teams`.

### Bracket Tab

- [x] 🔴 **[BracketTab.tsx]** Format selector UI — already present and working.
- [x] 🔴 **[BracketTab.tsx]** Ghost bracket previews — `GhostMatchCard` (pre-generate) + `GhostBracketOverlay` blur+CTA (post-generate, pre-seed).
- [x] 🔴 **[BracketTab.tsx]** Seed/shuffle step UI — `StepIndicator` (Format→Generate→Shuffle), primary green CTA when unseeded, secondary Re-Shuffle after.
- [x] 🟠 **[BracketTab.tsx]** SVG connector lines — implemented in `SingleElimCanvas` + `DoubleElimCanvas`.
- [x] 🟠 **[BracketTab.tsx]** Score input — click-to-edit numeric already on `PlayerRow`.

### Teams Tab

- [ ] 🟡 **[TeamsTab.tsx]** Review admin vs. non-admin UI layout.

### Maps Tab

- [x] 🔴 **[MapsTab.tsx + api/maps/route.ts]** Rework spin flow: landed map → `usedMaps` pool, not deleted from master list.
- [x] 🟠 **[MapsTab.tsx]** Show "Current Round Map" prominently after spin.
- [ ] 🟡 **[MapsTab.tsx]** No visual feedback when map dropped onto stage slot.

---

## 🚀 Enhancement (Remaining)

- [x] 🟠 **[TeamsTab.tsx + api/teams/route.ts]** `swapPlayer` action — moves player between teams atomically.
- [ ] 🟡 **[PlayersTab.tsx]** No queue cap / "lock queue" toggle.
- [ ] 🟡 **[page.tsx]** No connection status indicator.
- [ ] 🟡 **[AdminModal.tsx]** No 403 session expiry feedback.
- [ ] 🟢 **[page.tsx]** Tab bar no scroll affordance on mobile.
- [ ] 🟢 **[BracketTab.tsx]** Champion banner pulse runs indefinitely.
- [ ] 🟢 **[MapsTab.tsx]** Wheel canvas fixed 260×260 — not responsive.

---

## 🆕 Generic hooks

- [x] **[hooks/useSSE.ts]** Generic `useSSE<T>` hook extracted; `useTournaments` uses it.
