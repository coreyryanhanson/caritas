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
verified: "2026-09-07"
docs: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392-about-the-indicators-api-documentation
operations:
  - name: sources
    via: paginate
    path: /v2/sources
    accept: json
    errorPath: 0.message
    pagination:
      style: page
      itemsPath: "1"
      pageParam: page
      pageSizeParam: per_page
      pageSize: 50
      totalCountPath: 0.total
    params:
      format:
        description: Response format. Defaults to `json` and must stay `json` — any other value makes the API answer with its XML error envelope instead.
        default: json
      source:
        description: Optional database id (or comma-separated ids) to filter the list itself.
---
# World Bank Indicators API v2

The World Bank Indicators API v2 exposes the World Bank's open data
catalog: countries, regions, income levels, lending types, languages,
topics, sources (the ~70+ statistical databases), and the indicator
data series themselves. No authentication is required — every endpoint
is public and read-only.

> **Scope note (staged authoring):** this guide currently ships the
> `sources` op only; the remaining top-level endpoints (`country`,
> `indicator`, `source`, `topic`, `region`, `incomeLevel`,
> `lendingType`, `languages`, and the `country/{codes}/indicator/{code}`
> data pattern) are being added. The `sources` op is the live,
> drift-proof list of databases — resolve `?source=` filters and browse
> indicators per database from it at runtime; this guide deliberately
> keeps no frozen source table in prose.

## Envelope: `[meta, records]`

Every v2 JSON response is a **two-element array**: element `0` is the
pagination meta object (`page`, `pages`, `per_page`, `total` — all
strings) and element `1` is the records array. The recipes therefore
declare `itemsPath: "1"` and read `totalCountPath: 0.total`.

## Error envelope (HTTP 200 with an error body)

The Indicators API reports most errors **inside a 200 response**: a
single-element array carrying a `message` list
(`[{"message":[{"id":"120","key":"Invalid value","value":"…"}]}]`). All
ops declare `errorPath: 0.message` (present only on error — success
element `0` is the meta object, which has no `message` key), so a bad
parameter fails as a structured error naming the id/key/value instead
of reading as an empty result. Verified live 2026-09-07: an invalid
path value (e.g. a bad country code on a data call) and negative
`page`/`per_page` values all produce this shape. Note the executor
sanitizes a non-numeric `page`/`per_page` to its fallback before the
request, so those never reach the wire — the reachable triggers on this
endpoint are negative values and, on data calls, invalid path segments.

Two variants worth knowing:

- `format=bogus` (or any non-JSON `format`) answers with the **XML**
  `wb:error`/`wb:message` envelope instead — a different shape that
  `errorPath: 0.message` does not cover. The declared `format: json`
  default keeps calls on the covered shape; don't override `format`.
- **Unknown query parameters are silently ignored** (a typo'd param
  name is not an error — the call just succeeds without the filter).

## Operations

### `sources` — List the statistical databases

Returns the live catalog of World Bank data sources (~70+ entries, the
count drifts by design): each entry carries `id` (numeric), `code`,
`name`, `description`, `url`, `lastupdated`, and availability flags.
Use it to resolve which database a `?source=<id>` filter should target
on the other endpoints. Paginated (`page`/`per_page`; the API's default
page size is 50).

**Parameters:** `source` (optional filter), `format` (defaults to
`json` — leave it).

## Pagination

Page-based: `page` (1-indexed) / `per_page` (the API's default page
size is 50; no documented upper bound — `per_page=1000` is honored).
The meta element's `total`/`pages` drive multi-page walks.
Pass `gatherAll: true` to `api-fetch` to accumulate every page up to
the guide's configured ceiling.

## Terms

World Bank open data is available under their terms of use — see
<https://www.worldbank.org/en/about/legal/terms-of-use-for-world-bank-open-data>.
