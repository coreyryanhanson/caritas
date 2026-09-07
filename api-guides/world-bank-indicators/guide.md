---
kind: api
schemaVersion: 1
domains:
  - worldbank.org
  - api.worldbank.org
shortName: World Bank Indicators
icon: 🌍
apiHost: https://api.worldbank.org
auth:
  kind: none
responseShape:
  format: json
  charset: utf-8
pagination:
  style: page
  itemsPath: "1"
  pageParam: page
  pageSizeParam: per_page
  pageSize: 50
  totalCountPath: 0.total
verified: "2026-09-07"
docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
operations:
  - name: sources
    via: paginate
    path: /v2/sources
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Response format. Defaults to `json` and must stay `json` — any other value makes the API answer with its XML error envelope instead.
      source:
        description: Optional database id (or comma-separated ids) to filter the list itself.
  - name: countries
    via: paginate
    path: /v2/country
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Must stay `json` — any other value switches the API to its XML envelope.
      incomeLevel:
        description: Filter by income-level id (e.g. `LIC`); comma-separated ids act as OR.
      lendingType:
        description: Filter by lending-type id (e.g. `IDX`); comma-separated ids act as OR.
      region:
        description: Filter by region id (e.g. `LCN`) or `all` (default).
  - name: country
    via: paginate
    path: /v2/country/{codes}
    accept: json
    errorPath: 0.message
    params:
      codes:
        description: One or more country identifiers separated by `;` — ISO2, ISO3, or WB codes (e.g. `br`, `bra`, `br;no`), or `all` for every economy. Unknown codes are a 200 error envelope.
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
  - name: indicators
    via: paginate
    path: /v2/indicator
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
      source:
        description: Only list indicators from this database id (e.g. `2` for WDI).
  - name: indicator
    via: paginate
    path: /v2/indicator/{code}
    accept: json
    errorPath: 0.message
    params:
      code:
        description: Indicator code (e.g. `NY.GDP.MKTP.CD`). Browse codes via `indicators` filtered by `source`.
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
      source:
        description: Disambiguate an indicator code that belongs to multiple databases (e.g. `11`).
  - name: topics
    via: paginate
    path: /v2/topic
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
  - name: regions
    via: paginate
    path: /v2/region
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
  - name: incomeLevels
    via: paginate
    path: /v2/incomeLevel
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
  - name: lendingTypes
    via: paginate
    path: /v2/lendingType
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
  - name: languages
    via: paginate
    path: /v2/languages
    accept: json
    errorPath: 0.message
    params:
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
  - name: indicatorData
    via: paginate
    path: /v2/country/{countries}/indicator/{indicator}
    accept: json
    errorPath: 0.message
    params:
      countries:
        description: One or more country identifiers separated by `;` (ISO2/ISO3/WB codes, e.g. `br` or `chn;ago`), or `all`. Resolve codes via the `country` ops (see `countries`).
      indicator:
        description: Indicator code (e.g. `NY.GDP.MKTP.CD`).
      format:
        default: json
        description: Must stay `json` — any other value makes the API answer with its XML error envelope instead.
      date:
        description: Year, month, or quarter — single value (`2000`, `2012M01`, `2013Q1`), range (`2000:2010`, `2012M01:2012M08`), or YTD (`YTD:2013`).
      mrv:
        description: Most-recent-values — fetch the last N observations instead of a date range.
      mrnev:
        description: Most-recent non-empty values — like `mrv` but skips gaps.
      gapfill:
        description: "`Y` — with `mrv`, backfill missing periods from up to N periods back."
      frequency:
        description: "`Q`/`M`/`Y` — with `mrv`, pick the observation frequency."
      footnote:
        description: "`y` — include per-observation footnote values."
      source:
        description: Database id for multi-source indicators (e.g. `2`); required when querying multiple `;`-separated indicator codes.
---
# World Bank Indicators API v2

The World Bank Indicators API v2 exposes the World Bank's open data
catalog: countries, regions, income levels, lending types, languages,
topics, sources (the ~70+ statistical databases), and the indicator
data series themselves. No authentication is required — every endpoint
is public and read-only.

The `sources` op is the live, drift-proof list of databases
(id/code/name); agents resolve `?source=` filters and browse indicator
codes via `indicators` with `source` at runtime — this guide
deliberately keeps no frozen source table in prose.

> Docs grounding: the endpoint set, params, and pagination semantics
> below are derived from the official v2 documentation (hub:
> [About the Indicators API](https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation),
> [Basic Call Structures](https://datahelpdesk.worldbank.org/knowledgebase/articles/898581-api-basic-call-structures),
> [Country API Queries](https://datahelpdesk.worldbank.org/knowledgebase/articles/898590-country-api-queries),
> [Indicator API Queries](https://datahelpdesk.worldbank.org/knowledgebase/articles/898599-indicator-api-queries)).
> Envelope shapes were then verified live 2026-09-07 (see below).

## Envelope: `[meta, records]`

Every v2 JSON response is a **two-element array**: element `0` is the
pagination meta object (`page`, `pages`, `per_page`, `total` — all
strings; data calls add `sourceid` and `lastupdated`) and element `1`
is the records array. All ops declare `itemsPath: "1"` and
`totalCountPath: 0.total`, so `api-fetch` returns clean record arrays
and surfaces the server total. Even single-record lookups
(`country`, `indicator`) return the envelope with `total: 1` — the
records ride element `1` there too, which is why they are declared
`paginate` rather than `restGet`.

## `format` must be `json` on every call

The API's default output format is **XML**, and the `Accept` header
does not override it — only the `format=json` query string does. Every
op therefore declares a `format` param defaulting to `json`; leave it
alone. Any other value makes the API answer with its XML error
envelope instead (see below).

## Error envelope (HTTP 200 with an error body)

The Indicators API reports most errors **inside a 200 response**: a
single-element array carrying a `message` list
(`[{"message":[{"id":"120","key":"Invalid value","value":"…"}]}]`). All
ops declare `errorPath: 0.message` (present only on error — success
element `0` is the meta object, which has no `message` key), so a bad
parameter fails as a structured error naming the id/key/value instead
of reading as an empty result. Verified live 2026-09-07: an invalid
country code on `indicatorData`, an invalid `source` filter, and
negative `page`/`per_page` values all produce this shape (multiple
`message` entries can ride the same array). Note the executor
sanitizes a non-numeric `page`/`per_page` to its fallback before the
request, so those never reach the wire — the reachable triggers are
negative values and invalid path/filter segments.

Two variants worth knowing:

- `format=bogus` (or any non-JSON `format`) answers with the **XML**
  `wb:error`/`wb:message` envelope instead — a different shape that
  `errorPath: 0.message` does not cover. The declared `format: json`
  default keeps calls on the covered shape; don't override `format`.
- **Unknown query parameters are silently ignored** (a typo'd param
  name is not an error — the call just succeeds without the filter).
  Verified live 2026-09-07: this also applies to two plausible-looking
  filters that do nothing — `topic` on `indicators` and `source` on
  `countries` both return the unfiltered total.

## Operations

### Catalog (list) ops — `sources`, `countries`, `indicators`, `topics`, `regions`, `incomeLevels`, `lendingTypes`, `languages`

Each lists one slice of the catalog, paginated with
`page`/`per_page` (API default page size 50). `countries` entries
carry ISO2/ISO3 codes, region, income level, lending type, capital,
and coordinates — the resolution tables for `indicatorData`'s
`countries` argument. `indicators` is the full ~29k-series catalog;
filter it with `source` (database id from `sources`) rather than
paging through it bare.

### Get ops — `country`, `indicator`

`country` fetches one or more economies by code(s) (`;`-separated);
`indicator` fetches one indicator's metadata (code, name, unit,
source, source note, organization, topics) by code. Both return the
standard envelope (a one-record page).

### `indicatorData` — the data itself

`/v2/country/{countries}/indicator/{indicator}` returns per-observation
records: `{indicator:{id,value}, country:{id,value}, countryiso3code,
date, value, unit, obs_status, decimal}`. Scope with `date` (value or
`:` range, including month/quarter granularity and `YTD`), or use
`mrv`/`mrnev` for the most recent N (non-empty) values, optionally with
`gapfill` and `frequency`. Pass `source` when querying multiple
indicator codes in one call (max 60, `;`-separated, same database).
`countries: all` walks every economy — pair it with `date` or `mrv` to
keep the result-set bounded, and use `gatherAll` deliberately here
(e.g. all countries × one year is one page at a large `per_page`;
all countries × all years is thousands of pages).

## Pagination

Page-based: `page` (1-indexed) / `per_page` (the API's default page
size is 50; no documented upper bound — `per_page=1000` is honored).
The meta element's `total`/`pages` drive multi-page walks.
Pass `gatherAll: true` to `api-fetch` to accumulate every page up to
the guide's configured ceiling.

## Terms

World Bank open data is available under their terms of use — see
<https://www.worldbank.org/en/about/legal/terms-of-use-for-world-bank-open-data>.
