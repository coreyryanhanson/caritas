---
kind: api
schemaVersion: 1
domains:
  - world.openfoodfacts.org
  - openfoodfacts.org
shortName: Open Food Facts
icon: 🥫
apiHost: https://world.openfoodfacts.org
auth:
  kind: none
responseShape:
  format: json
  charset: utf-8
pagination:
  style: page
  itemsPath: products
  pageParam: page
  pageSizeParam: page_size
  pageSize: 24
  totalCountPath: count
verified: "2026-09-03"
docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
operations:
  - name: searchProducts
    via: paginate
    path: /api/v2/search
    accept: json
    requiresAnyOf:
      - search_terms
      - categories_tags_en
      - brands_tags_en
      - countries_tags_en
    params:
      search_terms:
        description: Free-text search across product names, brands, and ingredients.
      categories_tags_en:
        description: Category filter in English tag form, e.g. `Yogurts`, `Sparkling waters`.
      brands_tags_en:
        description: Brand tag filter, e.g. `danone`.
      countries_tags_en:
        description: Country tag filter, e.g. `germany`.
      fields:
        description: >
          Comma-separated whitelist of product fields to return (e.g.
          `code,product_name,brands,nutriscore_grade`). Strongly recommended
          — full products are large and the search endpoint is slow enough
          as it is.
---
# Open Food Facts — Search API v2

Community-run open database of food products worldwide (AGPL-3.0,
Open Food Facts non-profit). No authentication for read endpoints.

This is the **numeric-`page` shape** recipe: Search API v2 paginates with a
1-based `page` query param plus `page_size`, and echoes the requested page
back as a JSON **number** in the body (`page`, `page_count`, `page_size`,
`count`). The `page` pagination style drives `?page=N+1` client-side and
`totalCountPath: count` surfaces the numeric server total as `serverTotal`.

## Operations

### `searchProducts` — Search the product database

Returns products matching at least one filter (the op refuses a bare call —
an unfiltered query scans the whole database). Each product is a large
object; pass `fields` to project a lean set (`code,product_name,brands`
at minimum).

**Common filters:** `search_terms`, `categories_tags_en`,
`brands_tags_en`, `countries_tags_en` (at least one required). Tags are the
lowercase hyphenated English forms (`Yogurts`, `germany`).

## Pagination and limits

`page` style: the executor seeds `page=1` and increments, sending
`page_size` from the declared default (24) or your caller value.

Known service limits (community infrastructure — plan around them):

- **Deep-pagination wall:** requests beyond roughly `skip ≥ 1000`
  (`page × page_size`) are rejected with misleading HTML error pages
  (HTTP 401/503 with an "Error" page body, not JSON). Gathered walks must
  stay under ~1000 accumulated items — set `gatherAllMax` accordingly
  rather than draining.
- **Load-shedding 503s:** the service is run by a non-profit and
  intermittently answers HTTP 503 under load, including on healthy
  requests. Retry with backoff; keep `page_size` modest.
