# caritas

> **Reference API recipe library for
> [pi-lean-host](https://github.com/coreyryanhanson/pi-lean-dimension/tree/main/packages/pi-lean-host)** —
> the structured-data plugin for the [Pi](https://github.com/earendil-works/pi)
> coding agent. Each recipe is a small, versioned YAML file that teaches
> pi-lean-host how to call one REST API: its endpoints, auth, pagination, and
> response shape. Copy a recipe into your own guides directory and it just
> works; no recipe here ever executes on its own.

---

## ⚠️ Recipes drift — read this first

Every recipe in this repo was **verified against a specific pi-lean-host
schema version and its live endpoint as of the date in that guide's
`verified:` field**. Public APIs change without notice. A recipe that worked
the day it was committed can break the day the upstream API ships a new
version, renames a field, retires an endpoint, tightens its auth, or puts
itself behind a WAF.

**These recipes are a head start, not a maintenance contract.** The intended
way to use pi-lean-host is to **have your own Pi agent author guides as you
need them** — point it at an API's docs, let `/api probe` draft the operation
blocks, and it writes a recipe straight into your guides directory. That is
the primary path: guides produced on demand, for the APIs *you* actually use,
by the agent that already has your context. caritas is the secondary path — a
library of worked examples to copy when you'd rather not author from scratch.

Accordingly, the priority of this repo is keeping `pi-lean-host` itself
healthy; chasing every upstream API drift across a growing catalog is
explicitly *not* the goal. The larger the catalog grows, the more surface
there is to go stale, and maintainer attention goes to the framework first.
Expect individual recipes here to go out of date and break — that is the
tradeoff for having a broad, copyable library rather than none.

When a recipe breaks, you have two paths, both first-class:

1. **Author your own guide from scratch.** Pi-lean-host ships authoring
   tools for exactly this: run `/api learn` to enable `api-learn` +
   `api-probe`, probe the endpoint to draft an operation block, and write the
   recipe to your own guides directory.
2. **Fix the recipe and open a PR.** The format is a small, documented YAML —
   see [`api-guides/CONTRIBUTING.md`](api-guides/CONTRIBUTING.md). Most drift
   is a one-line patch (a renamed field, a moved `itemsPath`, a new required
   param), and your fix keeps the catalog healthy for the next person.

---

## What's in here

```text
api-guides/<domain>/
├── guide.md                       ← the recipe YAML (source of truth)
├── helper.ts                      ← optional; a transform the recipe can't express
├── endpoint-coverage.test.ts      ← live coverage; runs under HOST_INTEGRATION=1
├── endpoint-coverage-plan.md      ← frozen audit of the API's endpoints (read-only)
├── helper.test.ts / transform.test.ts  ← present iff helper.ts exists
└── spec/                          ← optional cached docs (local dev only, gitignored)
```

Each `<domain>/` folder is self-contained and inert until you copy it into
your own pi-lean-host guides directory. Nothing in this repo auto-executes.

### Domains covered

```text
api.gbif.org             api.github.com           archive.org              archive.org-wayback
arxiv.org                boe.es                   coingecko.com            data-api.ecb.europa.eu
datos.gob.es             earthquake.usgs.gov      en.wikipedia.org         en.wikipedia.org-action
etherscan.io             eutils.ncbi.nlm.nih.gov  gitlab.com               loc.gov
musicbrainz.org          openlibrary.org          resources.data.gov       services.dnb.de
web.archive.org          www.federalregister.gov  www.wikidata.org
```

The spread covers both **no-auth** APIs and **keyed** APIs
(`auth.kind: static-key`) — the latter exercising header refs, query refs
(`?key=`), and the required/optional split. `boe.es` is the reference
template for no-auth guides; `api.github.com`, `coingecko.com`, and
`etherscan.io` are the keyed references.

---

## Using a recipe

Recipes are inert until copied into your pi-lean-host guides directory. From
a clone of this repo:

```bash
# copy the whole catalog
git clone https://github.com/coreyryanhanson/caritas.git /tmp/caritas
cp -r /tmp/caritas/api-guides/* ~/.pi/agent/pi-lean-host/api-guides/

# or grab a single domain
cp -r /tmp/caritas/api-guides/en.wikipedia.org ~/.pi/agent/pi-lean-host/api-guides/
```

Only then does the recipe load and execute. For keyed recipes, the API key
never lives in the recipe — you provision it via `/api secrets` and
pi-lean-host injects it at fetch time. See pi-lean-host's
[Authentication & Secrets](https://github.com/coreyryanhanson/pi-lean-dimension/tree/main/packages/pi-lean-host#authentication--secrets)
docs.

If a copied recipe breaks (see the disclaimer above), the fastest fix is
usually to re-probe the endpoint with `/api probe` and patch the one field
that drifted.

---

## For contributors

This is a **devDep-only source repo — never published to npm.** Its own test
tooling is the consumer: `pi-lean-host` is installed from npm as a pinned
version in `devDependencies`.

Before adding a guide, read [`api-guides/CONTRIBUTING.md`](api-guides/CONTRIBUTING.md)
— it covers the recipe shape, when to reach for a `helper.ts`, and the
keyed-guide auth rules. Authoring starts from **official API docs**, not from
probing; cite a docs URL on every operation row.

### Test tiers

Two-tier by design:

- **Per-PR (fast, gated, no network):** `npm run test:ci` —
  `__tests__/all-guides-parse.test.ts` parses every recipe via
  `parseApiGuide`, plus the mocked-transport `helper.test.ts` /
  `transform.test.ts` files. A recipe that breaks parsing or helper wiring
  fails fast here.
- **Nightly (slow, non-gating, live):** `HOST_INTEGRATION=1 npm test` —
  runs every `endpoint-coverage.test.ts` against the real endpoints. **Red
  is a drift signal, not a gate.** A failing nightly means an upstream API
  drifted, not that a PR is blocked.

The live gate lives in `api-guides/_shared/test-harness.ts`: `itWhen` is
`it.skip` unless `HOST_INTEGRATION=1`, so bare CI is no-network by
construction — no extra skip logic needed.

```bash
npm test                       # full suite (live tests skip without HOST_INTEGRATION=1)
npm run test:ci                # fast, deterministic, no network
HOST_INTEGRATION=1 npm test    # live tier — real network calls
npx vitest run api-guides/boe.es/helper.test.ts   # one file
```

### Pinned npm devDep

`pi-lean-host` is installed as a pinned version in `devDependencies`.
Bumping it is a deliberate, reviewed PR — a host schema change should be a
visible event here, not a silent break.

---

## Relationship to pi-lean-host

| Thing | Where it lives | Who maintains | Published? |
| ----- | -------------- | ------------- | ---------- |
| Framework (`api-fetch`, `api-learn`, `api-probe`, recipe parser) | [pi-lean-host](https://github.com/coreyryanhanson/pi-lean-dimension/tree/main/packages/pi-lean-host) | maintainers | npm |
| **Recipe library** (this repo) | `caritas` (`api-guides/<domain>/`) | maintainers + contributors | no — copy what you need |
| Synthetic axis fixtures | pi-lean-host's own `api-guides/` | maintainers | bundled, framework-internal |

caritas is the catalog of real, verified recipes. pi-lean-host itself ships
only synthetic fixtures that exercise every framework axis via mocked
transport — they are framework test fixtures, not recipes for you to copy.

---

## License

[GNU AGPL-3.0](LICENSE)
