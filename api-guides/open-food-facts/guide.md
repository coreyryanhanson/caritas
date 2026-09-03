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
gatherAllMax: 480
verified: "2026-09-03"
docs: https://openfoodfacts.github.io/openfoodfacts-server/api/
operations:
  # ── Group A — Products (read) ─────────────────────────────────────
  # `passthrough: true` everywhere: the real query surface is far wider
  # than any param roster (every `*_tags` family, language-suffixed
  # variants like `categories_tags_fr`, nutriment conditions like
  # `sugars_100g<8`) — declared params are the high-frequency ones, the
  # rest flows through as the caller supplies it.
  - name: getProduct
    via: restGet
    path: /api/v2/product/{barcode}.json
    accept: json
    passthrough: true
    params:
      barcode:
        description: >
          Product barcode (EAN/GTIN). Missing/unknown codes return HTTP 200
          with `status: 0` and `status_verbose: "no code or invalid code"` —
          check `status`, not the HTTP code.
      fields:
        description: >
          Comma-separated whitelist of product fields to return (e.g.
          `code,product_name,brands,nutriments,nutriscore_grade`). Strongly
          recommended — full products are large. Special aggregates:
          `attribute_groups`, `knowledge_panels`.
      blame:
        description: >
          `blame=1` adds per-field edit attribution (`userid`, `t`, `rev`,
          `value`) to the response.
  - name: searchProducts
    via: paginate
    path: /api/v2/search
    accept: json
    passthrough: true
    requiresAnyOf:
      - categories_tags_en
      - brands_tags_en
      - countries_tags_en
      - labels_tags
      - nutrition_grades_tags
      - code
    params:
      categories_tags_en:
        description: Category filter in English tag form, e.g. `Yogurts`, `Sparkling waters`.
      brands_tags_en:
        description: Brand tag filter, e.g. `danone`.
      countries_tags_en:
        description: Country tag filter, e.g. `germany`.
      labels_tags:
        description: Label tag filter (taxonomized ids), e.g. `en:organic`.
      nutrition_grades_tags:
        description: Nutri-Score filter, e.g. `a` (single) or `a|b` (OR).
      code:
        description: Barcode filter; also the bulk-lookup key (comma-separated list).
      sort_by:
        description: >
          Sort key, e.g. `product_name`, `last_modified_t`, `created_t`,
          `scans_n`, `unique_scans_n`.
      fields:
        description: >
          Comma-separated whitelist of product fields to return (e.g.
          `code,product_name,brands,nutriscore_grade`). Strongly recommended
          — full products are large and the search endpoint is slow enough
          as it is.
  - name: getProductsByCodes
    via: restGet
    path: /api/v2/search
    accept: json
    passthrough: true
    params:
      code:
        required: true
        description: >
          Comma-separated barcode list for a bulk lookup (no pagination —
          the server returns all matches in one shot). e.g.
          `3263859883713,8437011606013,6111069000451`.
      fields:
        description: >
          Comma-separated whitelist — strongly recommended; same field
          grammar as `getProduct`.
  - name: extractIngredientsOcr
    via: restGet
    path: /cgi/ingredients.pl
    accept: json
    passthrough: true
    params:
      code:
        required: true
        description: Product barcode whose ingredient image to OCR.
      id:
        required: true
        description: >
          Image field id to OCR, e.g. `ingredients_en`, `ingredients_fr`.
      process_image:
        description: >
          `1` — force OCR re-extraction from the stored image. Without it the
          cached OCR result is returned (which may be empty). This triggers a
          real Google Cloud Vision call on the community's tab — use only
          when the cached result is missing or stale.
      ocr_engine:
        default: 2
        description: >
          OCR engine: `1` = tesseract (local), `2` = Google Cloud Vision
          (default — notably better on messy label photos).
  # ── Group B — Taxonomy & personal-search metadata ─────────────────
  - name: getTaxonomyEntries
    via: restGet
    path: /api/v2/taxonomy
    accept: json
    passthrough: true
    params:
      tagtype:
        required: true
        description: >
          Taxonomy to query: `categories`, `labels`, `ingredients`,
          `additives`, `allergens`, `brands`, `packaging`, `states`,
          `countries`, `origins`, `traces`, `stores`, `emb_codes`,
          `nutrients`, `languages`, …
      tags:
        required: true
        description: >
          Comma-separated list of taxonomy tag ids (language-prefixed,
          e.g. `en:organic,en:fair-trade`) or known synonyms.
      fields:
        description: >
          Comma-separated whitelist of node fields to return, e.g.
          `name,description,children,parents,wikidata`.
      include_children:
        description: '`1` — include child entries in the response.'
      include_parents:
        description: '`1` — include parent entries in the response.'
      include_root_entries:
        description: '`1` — include root taxonomy entries in the response.'
      lc:
        description: Language code(s) for localized names, comma-separated (e.g. `en,fr`).
      cc:
        description: Country context (e.g. `fr`).
  - name: listAttributeGroups
    via: restGet
    path: /api/v2/attribute_groups
    accept: json
    passthrough: true
    params:
      lc:
        description: Language code for attribute names/notes (e.g. `en`).
  - name: listPreferences
    via: restGet
    path: /api/v2/preferences
    accept: json
    passthrough: true
    params:
      lc:
        description: Language code for preference names (e.g. `en`).
  # ── Group C — Legacy lookup helpers (cgi) ─────────────────────────
  - name: suggestTags
    via: restGet
    path: /cgi/suggest.pl
    accept: json
    passthrough: true
    params:
      tagtype:
        required: true
        description: >
          Tag type to suggest values for: `brands`, `categories`, `labels`,
          `ingredients`, `countries`, `stores`, `origins`, `traces`,
          `additives`, `allergens`, `packaging_shapes`, `packaging_materials`,
          `emb_codes`, `states`, `languages`, `nutrients`, `minerals`.
      term:
        required: true
        description: Case-insensitive substring to match (may be a prefix, e.g. `da`).
  - name: getNutrientsTree
    via: restGet
    path: /cgi/nutrients.pl
    accept: json
    passthrough: true
    params:
      lc:
        description: Language code for nutrient display names (e.g. `en`).
      cc:
        description: Country context for local nutrient-table conventions.
---
# Open Food Facts — API v2

Community-run open database of food products worldwide (AGPL-3.0,
Open Food Facts non-profit). No authentication for read endpoints.

This is the **numeric-`page` shape** recipe: Search API v2 paginates with a
1-based `page` query param plus `page_size`, and echoes the requested page
back as a JSON **number** in the body (`page`, `page_count`, `page_size`,
`count`). The `page` pagination style drives `?page=N+1` client-side and
`totalCountPath: count` surfaces the numeric server total as `serverTotal`.

## Operations

### Products

- **`getProduct`** — one product by barcode. Full products are large; pass
  `fields` (`code,product_name,brands,nutriments` at minimum). **A missing
  barcode is HTTP 200 with `status: 0`** and `status_verbose: "no code or
  invalid code"` — check `status`, not the HTTP code. `blame=1` adds
  per-field edit attribution.
- **`searchProducts`** — the paginated structured search (at least one
  filter required; a bare call scans the whole database). See the filter
  grammar below.
- **`getProductsByCodes`** — bulk barcode lookup on the same search
  endpoint via the comma-separated `code` param; all matches return in one
  un-paginated shot.
- **`extractIngredientsOcr`** — OCR of a product's ingredient label image
  (`code` + `id=ingredients_<lc>`). Pass `process_image=1` to re-run OCR
  (cached results are returned otherwise, and may be empty);
  `ocr_engine: 1` = tesseract, `2` = Google Cloud Vision (default).
  Responses vary with image quality — a clean read returns
  `ingredients_text_from_image`; an unreadable label returns `{}` or
  `status: 0` with no text.

### Taxonomy & personal-search metadata

- **`getTaxonomyEntries`** — selected nodes from one of the taxonomies
  (`tagtype` + `tags`), with optional `include_children=1` /
  `include_parents=1` / `include_root_entries=1` and localized `name` /
  `description` via `fields` + `lc`. Prefer this over downloading a full
  taxonomy.
- **`listAttributeGroups`** — the attribute definitions behind personal
  search (Nutri-Score, Nova, eco-score, …) with icons and setting notes.
- **`listPreferences`** — the four preference weights (`not_important` …
  `mandatory`, with `factor` and `minimum_match`) used to score products.

### Legacy lookup helpers (cgi)

- **`suggestTags`** — type-ahead suggestions for a tag type (`term` is a
  case-insensitive substring). Returns a plain array of display strings.
  Taxonomized values only — for all actually-used values see
  [Search-a-licious](https://search.openfoodfacts.org/docs) (separate
  service, out of scope here).
- **`getNutrientsTree`** — the nutrient hierarchy (ids, units, display
  names, nesting) for rendering nutrition-facts tables.

## Search filters (searchProducts)

All `_tags` params share one grammar — declare-or-passthrough, the declared
roster is only the common ones:

- single value: `labels_tags=en:organic`
- comma = AND: `labels_tags=en:organic,en:fair-trade`
- pipe = OR: `labels_tags=en:organic|en:fair-trade`
- `-` prefix = exclude: `labels_tags=en:organic,en:-fair-trade`
- language-suffixed variants (`categories_tags_en`, `brands_tags_fr`, …)
  take un-prefixed tag forms.

**Nutriment conditions** are encoded in the param name (passthrough):
`energy-kj_100g<200`, `sugars_serving>10`, `salt_100g=1`; add `_prepared_`
for the prepared product (`salt_prepared_serving<0.1`).

**Sorting:** `sort_by` (e.g. `last_modified_t`, `product_name`, `scans_n`).

## Pagination and limits

`page` style: the executor seeds `page=1` and increments, sending
`page_size` from the declared default (24) or your caller value. `count`
is the total number of matching products — beware that `page_count` is the
number of products returned on the *current page*, not the total page
count (compute pages as `Math.floor((count - 1) / page_size) + 1`).

Known service limits (community infrastructure — plan around them):

- **Deep-pagination wall:** requests beyond roughly `skip ≥ 1000`
  (`page × page_size`) are rejected with misleading HTML error pages
  (HTTP 401/503 with an "Error" page body, not JSON). The guide declares
  `gatherAllMax: 480` (20 pages × 24) to keep gathered walks well under
  the wall — raise it per-call only for narrow filtered queries.
- **Load-shedding 503s:** the service is run by a non-profit and
  intermittently answers HTTP 503 under load, including on healthy
  requests. Retry with backoff; keep `page_size` modest.
- **Unknown tag types are silent:** `taxonomy?tagtype=nosuch` returns `{}`,
  not an error — verify the tag type against the facets vocabulary if a
  taxonomy query comes back empty.

## Notes & quirks

- **The `/facets/...` web endpoints** (`/facets/brands.json`,
  `/facets/brands/danone.json`) are legacy aliases of `searchProducts`
  with a tag filter (same `{count, page, page_size, products}` envelope);
  they are not declared as ops — use `searchProducts`.
- **`api/v2/search` has no full-text mode** — `search_terms` is silently
  ignored (it "filters" nothing: the count comes back as the whole
  database). Filter by tags, not names; for genuine full-text search use
  Search-a-licious (separate service) or the legacy v1 `/cgi/search.pl`.
- **Knowledge panels & product attributes** are product *fields*, not
  endpoints: `getProduct` with
  `fields=knowledge_panels` / `fields=attribute_groups`.
- **OCR is best-effort:** `extractIngredientsOcr` returns `{}` when the
  image yields nothing — try another `id` (`ingredients_fr`, …) or
  `process_image=1`.
- The v2 OpenAPI reference (`docs/api/ref/api.yaml`) is the source of
  truth for these routes; write endpoints (`/cgi/product_jqm2.pl`,
  image upload/crop, session) are out of scope — this recipe is read-only.
