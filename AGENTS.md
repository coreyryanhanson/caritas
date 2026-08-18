# caritas — agent notes

Reference **API guide recipes** for `pi-lean-host`. A devDep-only **source**
repo (never published to npm); its own test tooling is the consumer. Every
guide is a versioned YAML recipe consumed by the `pi-lean-host` framework.

## Commands

- `npm test` — `vitest run`, the full suite (parse + mocked-transport + the
  `it.skip`-gated live tests, which skip without `HOST_INTEGRATION=1`).
- `npm run test:ci` — same but excludes `**/endpoint-coverage.test.ts`
  (the live-only files). Use this for a fast, deterministic, no-network run.
- Run one file: `npx vitest run api-guides/boe.es/helper.test.ts`
- Run a single test by name: `npx vitest run -t "parses cleanly"`
- Live (nightly) tier: `HOST_INTEGRATION=1 npx vitest run` — runs the real
  network calls. Red is a **drift signal**, not a gate.
- Probe one op against the live endpoint without writing a test:
  `npx tsx api-guides/_shared/probe-op.ts <domain> <operation> [--params '{"k":"v"}'] [--gatherAll]`

No `lint` or `typecheck` script exists. `tsconfig.json` is `noEmit` strict
(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`allowImportingTsExtensions`); type errors surface via vitest/tsx at runtime,
not a separate gate. `include` is only `api-guides/**/*.ts` + `vitest.config.ts`
— root-level `.ts` files outside `api-guides/` are not type-checked.

## The devDep is a local path

`pi-lean-host` resolves via `"file:../pi-browser/packages/pi-lean-host"` —
that repo **must** exist at `../pi-browser/packages/pi-lean-host` for
`npm ci` to work. Bumping the devDep is a deliberate, reviewed PR (a host
schema change should be a visible event here, not a silent break). Switching
to a pinned published npm version is a deferred maintainer step.

## Test tiers and the live gate

Two-tier CI by design (`.github/workflows/` does not exist yet):

- **Per-PR** (fast, gated, no network): `__tests__/all-guides-parse.test.ts`
  parses every recipe via `parseApiGuide`, plus the mocked-transport
  `helper.test.ts` / `transform.test.ts` files.
- **Nightly** (slow, non-gating, live): all `endpoint-coverage.test.ts` under
  `HOST_INTEGRATION=1`.

The gate lives in `api-guides/_shared/test-harness.ts`: `itWhen` =
`(HOST_INTEGRATION ? it : it.skip)` and `withTempDirs(...)` is a no-op without
the env var. **Do not add extra skip/filter logic in CI** — the harness
already skips live tests in bare CI. The two tiers differ only in whether
`HOST_INTEGRATION=1` is set.

Tests are auto-discovered: `vitest.config.ts` includes
`api-guides/**/*.test.ts` and `__tests__/**/*.test.ts`. No central
registration — drop a co-located `*.test.ts` and it runs.

## Layout

```
api-guides/<domain>/
├── guide.md                       ← recipe YAML (the source of truth)
├── helper.ts                      ← optional; param or response transform
├── helper.test.ts / transform.test.ts  ← present iff helper.ts exists
├── endpoint-coverage.test.ts      ← live coverage; HOST_INTEGRATION=1-gated
├── endpoint-coverage-plan.md      ← frozen audit deliverable (read-only)
└── spec/                          ← optional cached docs (local dev only)
api-guides/_shared/                ← peer test plumbing, NOT framework code
api-guides/CONTRIBUTING.md         ← authoring guide — read before adding a guide
api-guides/WAF-NOTES.md            ← per-domain WAF/CAPTCHA tracker
__tests__/all-guides-parse.test.ts ← per-PR parse gate over every recipe
```

`api-guides/_shared/` is **peer test plumbing, not framework code**. Framework
code never imports it; guides reach it via the relative path
`../_shared/test-harness.js`. Reuse `withTempDirs`, `createFetchOp`, `itWhen`
from there. Keep per-file: any `fetchOp` wrapper that adds pacing / 503-retry
/ auth overlay, and the per-op assertions (these encode domain shape).

## Authoring a guide (read CONTRIBUTING.md first)

- **No-auth reference template:** `boe.es` — copy its pattern.
- **Keyed (`auth.kind: static-key`) templates:** `api.github.com` (optional
  header), `coingecko.com` (required header), `etherscan.io` (required
  `?key=` query).
- **Default to no `helper.ts`.** Express the shape via the recipe surface
  (`paginate`, `passthrough`, `itemsPath`, `accept`, `parse`, `dateParams`)
  first. Add `helper.ts` only when a transform the recipe can't carry is
  genuinely needed (positional-array zip, fat `properties` projection,
  structural reshape). Current helpers: `boe.es`, `earthquake.usgs.gov`,
  `en.wikipedia.org-action`, `web.archive.org`.
- Two helper modes, both in `helper.ts`:
  - `helper: true` on an op → param transform `(params, ctx) => params`
    (e.g. `boe.es` `fecha` ISO→YYYYMMDD; `from`/`to` use core `dateParams`
    instead — don't reimplement those).
  - `transform: true` on an op → response transform `(data, ctx) => unknown`,
    loaded by `loadTransform`, invoked at the `restGet` (whole-body) or
    `paginate` (per-item) hookpoint. A throw falls back to raw body with a
    warning — graceful, never disables the op. Pure function, no default export.
- **Secrets never live in the guide.** A keyed guide declares secret names
  (`secretRefs` / `secretQueryRefs` + `requires` / `optional`); values are
  provisioned in `~/.pi/agent/pi-lean-host/secrets/<domain>.json` via
  `/api secrets` and injected at fetch time. The parser enforces every auth
  rule with a `fix:` hint — a bad guide fails at **parse time**, not fetch
  time. `auth.kind: oauth2` is rejected ("not yet implemented").
- **Recipe fields that matter:** `apiHost`, `auth.kind` ∈ {none, static-key},
  op `via` ∈ {restGet, paginate}, op `path` must start with `/`. These are
  asserted by `all-guides-parse.test.ts`.

## Drafting an endpoint-coverage plan

Start from the API's **official docs**, not from probing. Probe to confirm
shapes; read docs to know what endpoints exist. Cite a docs URL on every
operation row — don't invent endpoints. **Read-only only**; if unsure
whether an endpoint mutates, treat it as out of scope and note the
uncertainty.

WAF/CAPTCHA quirks: many docs sit behind a WAF that blocks `curl`/`web-fetch`.
Use `browser-navigate` (Chromium) for those pages; for Swagger UI docs pull
the full OpenAPI spec via `browser-console`:
`window.ui.specSelectors.specJson().toJS()`. Record per-domain quirks in
`api-guides/WAF-NOTES.md` (see its template). The pi-lean-host tool itself
(Node `fetch()`) usually gets through where `curl` doesn't — point live tests
at the `apiFetch` pipeline, not raw `fetch()` in test code.

## Drift posture

Recipes are proven as of the `verified` date in each `guide.md`. Public APIs
change; a recipe may drift. There is **no `README.md` yet** — the planned
drift disclaimer (per-recipe `verified`-date provenance + the `/api learn` /
`/api probe` authoring escape hatch) is still TODO per
`docs/design/guides-decoupling-caritas-remaining-caritas.md`. Keep caritas's
drift disclaimer separate from any host-side "unstable" disclaimer — never
fold them together.
