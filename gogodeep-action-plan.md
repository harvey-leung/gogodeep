# GoGoDeep — Professional Quality Action Plan

**Last updated:** June 11, 2026
**Codebase reviewed:** Vite + React 18 + TS + Tailwind/shadcn frontend, Supabase backend (9 edge functions), Stripe billing.

**How to use this doc:** Work top to bottom. Each phase has a goal, concrete tasks with checkboxes, and a "done when" definition. Don't start a lower phase until the one above it is functionally complete — polish on a shaky foundation is wasted effort. Update the checkboxes and the "Last updated" date as we go.

---

## Phase 0 — Security (do this week, before anything else)

**Why first:** These are live financial and abuse risks, not code-quality opinions. Every day they sit open, someone can cost you real money.

### Critical

- [x] **Add authentication to `diagnose-image`.** It currently has *no* auth check (verified: the only "auth" reference in the file is a CORS header). Combined with `verify_jwt = false` in `config.toml`, anyone with the function URL can call your vision-AI endpoint unauthenticated and drain your AI budget. Either flip `verify_jwt = true` for it or add the same manual JWT validation `stream-generate` uses — and tie scan-credit checks to the *server*, not the client.
- [x] **Audit `verify_jwt = false` across all functions in `supabase/config.toml`.** It's set to false on every function. For each one, document why (only `stripe-webhook` has a legitimate reason — Stripe can't send JWTs; it correctly verifies signatures instead). Everything else should either use the platform JWT check or have manual validation confirmed in code.
- [x] **Verify scan-credit enforcement is server-side.** `checkScanCredits` is called from the client (`DiagnosticLab.tsx`). If the edge function doesn't independently re-check and decrement credits atomically, the limit is decorative.

### High

- [x] **Fix race conditions in rate limiting.** The chat throttle and quiz limits (per `SECURITY_FIXES.md`) read-then-write columns on `profiles`. Two concurrent requests both pass the check. Use an atomic SQL update (`UPDATE ... WHERE count < limit RETURNING ...`) or a Postgres function.
- [x] **Review RLS policies** on `profiles`, scans/reports tables, and anything storing user data. Confirm users can only read/write their own rows, and that the columns used for rate limiting can't be reset by the user via the client (they can update their own profile row → they can reset `whale_chat_minute_count` unless column-level protection or a `SECURITY DEFINER` function guards it).
- [x] **Input validation on edge functions** — size limits on uploaded images (server-side, not just the client's canvas compression), prompt length caps on chat/stream/quiz, and zod (already a dependency) schemas on request bodies.

### Done when
Every edge function either has platform JWT verification or documented, code-verified manual auth; credits and rate limits are enforced atomically server-side; a malicious user with the anon key and function URLs cannot spend your money.

---

## Phase 1 — Structural refactor (the foundation)

**Why second:** `Index.tsx` is 2,161 lines, `BlindSpotReport.tsx` is 1,991, `Stream.tsx` is 1,565. Every future change (including the polish phases below) gets slower and riskier until these are broken up. This is the difference between a Lovable prototype and a codebase you can build a business on.

### Tasks

- [ ] **Split `Index.tsx`** — it currently contains the marketing landing page *and* the authenticated dashboard (`DashboardRoute` is exported from it). Separate into `pages/Landing/` and `pages/Dashboard/` with their own component folders (Hero, FeatureGrid, QuizCard, etc.).
- [ ] **Split `BlindSpotReport.tsx`** into report sections (diagnosis view, practice problems, share/export, etc.) plus a `useReport` hook for data logic.
- [ ] **Split `Stream.tsx`** — extract the program-builder logic (`buildFallbackProgram`, ~70 lines of pure logic) into `lib/`, separate the wizard UI from the program viewer.
- [ ] **Extract data layer.** Supabase calls are scattered inline in pages. Move them into typed functions in `src/api/` or React Query hooks (`useScans`, `useProfile`, `useCredits`). You already have React Query installed — use it consistently instead of ad-hoc `useEffect` fetching.
- [ ] **Centralize localStorage/session keys.** Keys like `gogodeep_pending_report`, `gogodeep_dive_preview` are defined per-file. One `lib/storageKeys.ts`.
- [ ] **Enable TypeScript strict mode** (`tsconfig.app.json` currently has no `strict` setting) and burn down the `as any` casts (e.g., `(data.diagnosis as any)?.mode` in Index.tsx). Do this *during* the split, not after — it's free while you're already touching every line.
- [ ] **Define shared types** for core domain objects (Diagnosis, Scan, PracticeProblem, StreamProgram) in one place instead of inline interfaces per file.

### Done when
No page file exceeds ~400 lines; all Supabase access goes through a typed data layer; `strict: true` passes; the same logic exists in exactly one place.

---

## Phase 2 — Performance

**Why third:** Right now `App.tsx` has **zero** `lazy()` imports — every visitor to the landing page downloads the dashboard, report engine, all six interactive-model files, KaTeX, and Recharts in one bundle. This directly hurts conversion (slow first paint) and SEO.

### Tasks

- [ ] **Route-level code splitting.** `React.lazy()` + `Suspense` for every route. The landing page should ship only landing-page code.
- [ ] **Lazy-load the Interact models** — `PhysicsModels`, `ChemistryModels`, etc. are heavy and only needed on `/interact`, ideally only when their tab is opened.
- [ ] **Lazy-load KaTeX and Recharts** — both are large; only `/report` and dashboard charts need them.
- [ ] **Run a bundle analysis** (`vite-bundle-visualizer`) before and after; record the numbers below.
- [ ] **Image audit** — `public/` PNGs (whale art, og-image): convert to WebP where possible, set explicit dimensions to avoid layout shift, preload the hero image.
- [ ] **Measure Core Web Vitals** on the deployed site (PageSpeed Insights) before/after. Targets: LCP < 2.5s, CLS < 0.1, INP < 200ms on mobile.

### Metrics log

| Date | Landing JS (gzip) | LCP mobile | Notes |
|------|-------------------|------------|-------|
|      | (baseline TBD)    |            |       |

### Done when
Landing-page JS payload is a fraction of the full app; Lighthouse mobile performance ≥ 90 on `/`.

---

## Phase 3 — Reliability & testing

**Why now:** You have one example test. The logic most likely to silently break — credits, XP, rate limits, report parsing — is exactly the logic that costs money or trust when it breaks.

### Tasks

- [ ] **Unit tests for pure logic:** `lib/xp.ts` (XP calc, bonus logic), `Stream`'s fallback program builder, credit math, storage serialization.
- [ ] **Integration tests** for the data layer hooks with a mocked Supabase client.
- [ ] **Playwright smoke tests** (config already exists): landing loads → signup → upload flow reaches report → logout. Run on every deploy.
- [ ] **Error-state audit:** every fetch needs a visible failure state (not a silent console.error). Standardize on the existing `whaleToast` + ErrorBoundary per route segment.
- [ ] **Loading-state audit:** skeletons (component exists in ui/) for dashboard cards, report sections, history sidebar — no blank flashes.
- [ ] **CI:** GitHub Action running `lint`, `test`, `build` on every push. Nothing merges red.

### Done when
The money/trust paths (credits, XP, scan→report, checkout) have tests; CI is green and required.

---

## Phase 4 — UX & conversion polish

**Why after structure/perf:** These changes are cheap and safe once the code is modular and the pages load fast — and their impact is measurable.

### Tasks

- [ ] **Funnel walkthrough:** land → understand value in 5 seconds → first scan with zero friction. Count the clicks from landing to first report; reduce them.
- [ ] **Empty states:** new-user dashboard, empty history, no blindspots yet — each should teach the next action, not show a blank panel.
- [ ] **Unhappy paths:** scan fails, image rejected, credits exhausted, offline. Each needs a designed state with a recovery action. Professional products are defined by these, not the happy path.
- [ ] **Copy pass:** tighten hero/feature copy; consistent voice for the whale (currently spans from "Drop it like it's hot" to formal — pick a register and hold it).
- [ ] **Mobile audit:** the core user is a student on a phone photographing homework. Every flow must be one-thumb usable; test the upload flow on a real device.
- [ ] **Accessibility baseline:** keyboard nav through the main flows, focus states, alt text, contrast check on the brand palette, `prefers-reduced-motion` respected by the whale/hero animations.

### Done when
A first-time mobile user gets from landing to their first report without confusion; every failure mode has a designed screen.

---

## Phase 5 — Visual & brand refinement

- [ ] **Design-token audit:** consolidate colors/spacing/type into Tailwind theme tokens; kill one-off values.
- [ ] **Landing page hierarchy:** the hero currently stacks two `<h1>` elements (semantic problem and visual ambiguity) — restructure to one h1, clear visual rhythm.
- [ ] **Report page premiumization:** this is the product's "aha" screen and what users screenshot/share — typography, spacing, and data-viz polish here pays directly.
- [ ] **Motion polish:** consistent durations/easings via framer-motion variants; whale animations as delight, not distraction.
- [ ] **Dark/light consistency** (next-themes is installed — verify every custom component respects both).

### Done when
Side-by-side screenshots of before/after look like two different price points.

---

## Phase 6 — SEO & growth infrastructure

- [ ] Per-page titles/descriptions via react-helmet-async (installed) — currently only `index.html` is solid.
- [ ] `sitemap.xml` + verify `robots.txt` correctness.
- [ ] Open Graph image check (og-image.png exists — confirm dimensions 1200×630 and that it renders on X/Discord/iMessage).
- [ ] Consider whether GA + GTM + Ahrefs analytics are all needed — three trackers add weight and consent complexity; GTM alone can host the rest.
- [ ] Replace the README ("TODO: Document your project here") with real setup docs — future-you and any collaborator needs this.

---

## Working agreement

- Review this doc at the start of each working session; check off what's done, add what's discovered.
- One phase at a time. Scope creep is how 2,000-line files happen in the first place.
- Every change gets verified: security changes get attack-tested, perf changes get measured, refactors keep behavior identical (tests prove it).

## Decision log

| Date | Decision | Why |
|------|----------|-----|
| 2026-06-11 | Plan created; security first | `diagnose-image` found unauthenticated with `verify_jwt=false` globally |
| 2026-06-11 | Phase 0 implemented in 6 commits (branch `phase-0-security`) | diagnose-image now requires auth; guests gated by server-verified Cloudflare Turnstile + per-IP daily cap (table `guest_scan_usage`, fail-closed). Scan credits, whale-chat throttle/budget, and daily quiz limit moved to atomic SECURITY DEFINER functions (`consume_scan_credit`, `consume_whale_chat`, `consume_quiz_credit`, `claim_daily_login`). Client UPDATE on profiles revoked except `username`/`lab_state`. `verify_jwt` documented per function (true for create-checkout/billing-portal/weekly-digest; false+manual-auth for the AI fns; false+signature for stripe-webhook). zod validation on all bodies. **Not yet deployed** — owner to run migrations + `supabase functions deploy` and set `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY`. |
