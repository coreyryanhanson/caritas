# Guide Content Decoupling — Remaining Work (caritas)

> Continuation of the sprint plan in the host repo
> (`packages/pi-lean-host/docs/design/guides-decoupling-caritas-sprint-plan.md`).
> The content move (Sprint 4) is complete: every non-axis recipe + `_shared/` +
> `WAF-NOTES.md` + `CONTRIBUTING.md` lives here, imports migrated to
> `pi-lean-host/core/...`. Host-side remaining work (the Lockstep gate) lives
> in the host repo's own plan doc
> (`packages/pi-lean-host/docs/design/guides-decoupling-caritas-remaining-host.md`).
>
> **This doc is self-contained for the caritas work.** It captures the CI
> strategy and drift-disclaimer requirements inline (below) so they survive
> even if the upstream design doc is unavailable. The only remaining caritas
> work is **Sprint 5** (CI + drift disclaimer).

## Sprint 5 — Stand up caritas CI + README drift disclaimer

Give caritas the two-tier CI specified by the split — per-PR fast (parse +
mocked-transport, gated) and nightly live (`HOST_INTEGRATION=1`, non-gating
drift signal) — and land the README drift disclaimer. This is what makes the
split's "green by construction where achievable, drift-signal posture where
not" real: the per-PR tier keeps recipe PRs failing fast on deterministic
breaks, while the nightly tier reserves the drift-signal posture for the
genuinely flaky live calls.

**Gated on:** nothing further — Sprint 4 (the move) is done. This is the last
caritas sprint.

### CI strategy (requirements, self-contained)

Two tiers:

- **Per-PR (fast, gated, no network).** Runs parse-validity **plus** the
  mocked-transport recipe-correctness tests that move with the guides.
  Fast and deterministic, so a recipe PR that breaks parsing or a helper's
  transform wiring fails fast instead of waiting for the nightly run.
- **Nightly (slow, non-gating, live).** The live integration tests under
  `HOST_INTEGRATION=1`, on a schedule against the installed `pi-lean-host`
  devDep. These may be slow and occasionally red — red is the drift signal,
  not a gate.

### The live-gate harness (`itWhen` / `HOST_INTEGRATION`)

The live tests reuse the same gate the framework already uses, which moved
with `_shared/` into `api-guides/_shared/test-harness.ts`:

- The env var is `HOST_INTEGRATION`; it flips the tier when set to `"1"`
  (`process.env["HOST_INTEGRATION"] === "1"`).
- `test-harness.ts` exports `itWhen` = `(HOST_INTEGRATION ? it : it.skip)`.
  Under bare CI (no env var), every live test becomes `it.skip` — so the
  per-PR run is effectively no-network by construction. Under
  `HOST_INTEGRATION=1`, the same tests run for real.
- `withTempDirs(...)` (same file) is likewise a no-op when the env var is not
  set, so live fixtures aren't copied in bare CI.

So a single test file serves both tiers: it is skipped in the per-PR run and
executed in the nightly run. **CI must not do anything special to skip the
live tests in the per-PR tier — the harness already skips them.** The two
tiers differ only in *whether* `HOST_INTEGRATION=1` is set (and the schedule).

### Tasks

1. **Per-PR CI (fast, gated, no network):**
   - Parse-validity: run `parseApiGuide()` over every guide — the
     `__tests__/all-guides-parse.test.ts` suite (already exists in this repo).
   - Mocked-transport recipe-correctness: the `transform.test.ts` files and
     `helper.test.ts` that import the real `helper.ts` via mocked transport
     (e.g. `api-guides/{en.wikipedia.org-action,web.archive.org,earthquake.usgs.gov}/transform.test.ts`,
     `api-guides/boe.es/helper.test.ts`). These are coupled to the real
     `helper.ts` (which lives here), so they run here, fast and deterministic.
   - Both gated on PR status; a recipe PR that breaks parsing or helper wiring
     fails fast. `itWhen` auto-skips the live tests, so this tier needs no
     extra gating.
2. **Nightly CI (slow, non-gating, live):**
   - All `endpoint-coverage.test.ts` files (23) under `HOST_INTEGRATION=1`,
     against the installed `pi-lean-host` devDep.
   - Scheduled (cron), not PR-gated. Reds are the drift signal, not a gate.
   - Upload test artifacts on failure (vitest output, request traces).
3. **README drift disclaimer** — write `README.md` (none exists yet) owning
   the per-recipe statement:
   > Recipes here were verified against a specific pi-lean-host schema version
   > and their live endpoints as of the date in each guide's `verified` field.
   > Public APIs change; a recipe may drift out of date. Users can author their
   > own guides easily with pi-lean-host (`/api learn` + `/api probe`), or copy
   > a recipe here and adapt it — the format is a versioned, documented YAML.
   This is the "proven as of a date, may drift" posture plus the authoring
   escape hatch — a natural fit for a content repo, and it keeps the framework
   repo out of "X API broke" issue traffic.
4. Keep the `pi-lean-host` devDep as the local-path install from Sprint 4
   during development. Bumping it is a deliberate caritas PR (so a schema
   change in host is a visible, reviewed event in caritas, not a silent
   break). Switching the devDep from the local path to a pinned published npm
   version happens on the maintainer's own schedule once `pi-lean-host` is
   published with the exports map — independent of this plan.

### Two disclaimers, kept separate

Caritas's drift disclaimer (perpetual, "proven as of a date") stays forever.
Host's README unstable disclaimer (pre-lockstep, schema settling) is *removed
at lockstep*. They answer different questions and must not be conflated —
never fold them into one statement, and never remove caritas's at lockstep.

### Concrete CI shape (GitHub Actions, for reference)

There is **no `.github/` workflow yet** in this repo — one must be created.
Mirror the monorepo's `ci.yml` shape (Node setup + `npm ci` + run vitest) as
a `.github/workflows/` file. Two jobs:

- **`per-pr`** (on push/PR): `npm ci`, then run the full vitest suite
  (`all-guides-parse` + mocked-transport). `itWhen` skips the live tests
  automatically — no env var, no filter logic. This job is gating.
- **`nightly`** (on cron schedule): `npm ci`, then run
  `HOST_INTEGRATION=1 npx vitest run` over the `endpoint-coverage.test.ts`
  files. Non-gating — a red nightly is the drift signal. Upload test artifacts
  (vitest output, request traces) on failure.

### Exit criteria

- Per-PR CI runs parse-validity + mocked-transport tests green on a clean PR;
  a deliberately-broken guide fails it.
- Nightly CI runs the live `HOST_INTEGRATION=1` suite on schedule; failures are
  non-gating (drift signal only).
- `README.md` carries the drift disclaimer (exact wording in task 3 above),
  scoped to per-recipe `verified`-date provenance — distinct from any
  framework unstable disclaimer.
- `pi-lean-host` devDep present (local-path install during dev; npm-version pin
  is a deferred, maintainer-scheduled step).

## Deferred (maintainer's own schedule, not on this plan)

- Switching the `pi-lean-host` devDep from local-path to a pinned published npm
  version (after host publishes with the `exports` map). The design doc's CI
  strategy assumes this npm devDep; until then the local path serves nightly CI
  identically.
