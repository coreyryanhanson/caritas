---
kind: api
schemaVersion: 1
domains:
  - api.inaturalist.org
  - inaturalist.org
shortName: iNaturalist
icon: 🦋
apiHost: https://api.inaturalist.org
auth:
  kind: none
responseShape:
  format: json
  charset: utf-8
pagination:
  style: page
  itemsPath: results
  pageParam: page
  pageSizeParam: per_page
  pageSize: 100
  totalCountPath: total_results
gatherAllMax: 1000
verified: "2026-09-03"
docs: https://api.inaturalist.org/v1/docs/
operations:
  # ── Group A — Observations ────────────────────────────────────────
  # `passthrough: true` everywhere: /v1/observations alone exposes ~100
  # documented query params (annotation filters, DQA filters, bounding
  # boxes, project rules, …) — declared params are the high-frequency
  # ones, the rest flow through as the caller supplies them.
  #
  # listObservations is the derived-id cursor proof: op-level pagination
  # override switches it from the guide's page style to the stable
  # keyset walk (see the guide prose below). It has NO result-window
  # limit, unlike the page-style ops.
  - name: listObservations
    via: paginate
    path: /v1/observations
    accept: json
    passthrough: true
    pagination:
      style: cursor
      itemsPath: results
      cursorParam: id_above
      cursorPath: "results[-1].id"
      totalCountPath: total_results
      pageSizeParam: per_page
      pageSize: 30
    params:
      order_by:
        description: >
          Sort field. Both sort defaults are load-bearing for the derived-id
          keyset walk (see the guide prose below) — override the sort and
          the walk breaks.
        default: id
      order:
        default: asc
        description: >
          Sort order. asc + id_above walks forward through history without
          overlap or gaps; desc + id_above double-counts (the "above the
          cursor" region is the newest rows — where page 1 lives).
      per_page:
        description: >
          Results per page. The API maximum is 200, but each observation
          embeds full taxon and user objects — keep pages small (the recipe
          defaults to 30, the server's own default). Keep this at or under
          50 unless you really need depth.
      q:
        description: >
          Free-text search over observation properties (e.g. `monarch`).
          Can be combined with the other filters.
      taxon_id:
        description: >
          Filter by taxon id (or comma-separated ids — descendants are
          included). Prefer `taxon_name` when you know a name instead.
          Accepts a single value or an array (joined with commas).
        listStyle: comma
      taxon_name:
        description: >
          Taxon must have a scientific or common name matching this string
          (e.g. `Danaus plexippus`). Multiple values may be comma-separated.
          Accepts a single value or an array (joined with commas).
        listStyle: comma
      place_id:
        description: >
          Must be observed within the place with this ID (e.g. `1` is the
          United States). Multiple values may be comma-separated. Accepts a
          single value or an array (joined with commas).
        listStyle: comma
      user_id:
        description: Observer user id or login; restricts to that user's observations.
      quality_grade:
        description: >
          Comma-separated quality grades: `casual`, `needs_id`, `research`
          (research = community-confirmed). Accepts a single value or an
          array (joined with commas).
        listStyle: comma
      d1:
        description: Observed-on date lower bound (YYYY-MM-DD).
      d2:
        description: Observed-on date upper bound (YYYY-MM-DD).
      lat:
        description: Latitude for a radius search — pair with lng and radius.
      lng:
        description: Longitude for a radius search — pair with lat and radius.
      radius:
        description: Radius in km around lat/lng (default 10 km).
      geoprivacy:
        description: >
          Comma-separated geoprivacy filter: `open`, `obscured`, `private`.
          Accepts a single value or an array (joined with commas).
        listStyle: comma
  - name: getObservation
    via: restGet
    path: /v1/observations/{id}
    accept: json
    passthrough: true
    params:
      id:
        description: >
          Observation id. The response wraps the single observation in the
          usual list envelope (`total_results: 1`, object under `results[0]`).
  - name: getObservationTaxonSummary
    via: restGet
    path: /v1/observations/{id}/taxon_summary
    accept: json
    params:
      id:
        description: >
          Observation id. Returns the observation's taxon context:
          conservation status, listed taxon, Wikipedia summary, and
          taxon-change blocks.
  - name: getObservationHistogram
    via: restGet
    path: /v1/observations/histogram
    accept: json
    passthrough: true
    params:
      date_field:
        description: >
          Which date to bucket: `observed` (default) or `created`.
      interval:
        description: >
          Bucket size: `year`, `month`, `week`, `day`, `hour`, `month_of_year`,
          `week_of_year`. Default is `month_of_year` when no date range given.
      d1:
        description: Range lower bound (YYYY-MM-DD). Pair with d2 for a real histogram.
      d2:
        description: Range upper bound (YYYY-MM-DD).
      place_id:
        description: Restrict to a place id.
      taxon_id:
        description: Restrict to a taxon.
  - name: listObservationSpeciesCounts
    via: paginate
    path: /v1/observations/species_counts
    accept: json
    passthrough: true
    params:
      per_page:
        description: >
          Results per page (server-capped; 500 was honored live). Items are
          `{count, taxon}` rows — the species list behind any observation
          filter set. Same filters as listObservations flow through via
          passthrough (`taxon_id`, `place_id`, `d1`/`d2`, `quality_grade`, …).
  - name: listObservationIdentifiers
    via: paginate
    path: /v1/observations/identifiers
    accept: json
    passthrough: true
    params:
      per_page:
        description: Results per page (rows are `{user_id, count, user}`).
  - name: listObservationObservers
    via: paginate
    path: /v1/observations/observers
    accept: json
    passthrough: true
    params:
      per_page:
        description: >
          Results per page (rows are `{user_id, observation_count,
          species_count, user}`).
  - name: listPopularFieldValues
    via: paginate
    path: /v1/observations/popular_field_values
    accept: json
    passthrough: true
    params:
      per_page:
        description: >
          Results per page (rows are annotation usage counts by month —
          each row embeds a `month_of_year` histogram object).

  # ── Group B — Identifications ─────────────────────────────────────
  - name: listIdentifications
    via: paginate
    path: /v1/identifications
    accept: json
    passthrough: true
    params:
      per_page:
        description: Results per page — the API caps this at 200.
      taxon_id:
        description: Filter to identifications of this taxon (descendants included).
      user_id:
        description: Filter to identifications by this user (id or login).
      current:
        description: >
          `true` for the latest identification per user on an observation,
          `false` for superseded ones.
      category:
        description: >
          Comma-separated filter by category: `leading`, `supporting`,
          `improving`, `maverick` (see listIdentificationCategories).
  - name: getIdentification
    via: restGet
    path: /v1/identifications/{id}
    accept: json
    params:
      id:
        description: >
          Identification id. Same list envelope — the object sits under
          `results[0]`.
  - name: listIdentificationCategories
    via: paginate
    path: /v1/identifications/categories
    accept: json
  - name: listIdentificationIdentifiers
    via: paginate
    path: /v1/identifications/identifiers
    accept: json
    passthrough: true
    params:
      per_page:
        description: Results per page (rows are `{user_id, count, user}`).
  - name: listIdentificationObservers
    via: paginate
    path: /v1/identifications/observers
    accept: json
    passthrough: true
    params:
      per_page:
        description: Results per page (rows are `{user_id, count, user}`).
  - name: listRecentTaxa
    via: paginate
    path: /v1/identifications/recent_taxa
    accept: json
    passthrough: true
    params:
      per_page:
        description: >
          Results per page. Rows are newly-identified taxa with their first
          identification embedded (`taxon`, `identification`, `user`).
  - name: listSimilarSpecies
    via: paginate
    path: /v1/identifications/similar_species
    accept: json
    passthrough: true
    params:
      taxon_id:
        required: true
        description: >
          Taxon to compare (required — the server 422s without it). Returns
          the species most often confused with it, scored by co-occurrence
          of misidentifications.
  - name: listIdentificationSpeciesCounts
    via: paginate
    path: /v1/identifications/species_counts
    accept: json
    passthrough: true
    params:
      per_page:
        description: >
          Results per page (rows are `{count, taxon}` — species ranked by
          identification count). Same filters as listIdentifications flow
          through via passthrough.

  # ── Group C — Taxa ────────────────────────────────────────────────
  - name: listTaxa
    via: paginate
    path: /v1/taxa
    accept: json
    passthrough: true
    params:
      per_page:
        description: >
          Results per page (500 was honored live; the guide defaults to 100).
          Elasticsearch-backed — the result window applies (see the guide
          prose below); the endpoint also accepts `id_above`/`id_below`
          keyset params for deep walks past the window.
      q:
        description: >
          Name search across scientific and common names (e.g. `robin`
          matches both `Turdus migratorius` and common-name matches).
      id:
        description: >
          Exact match — comma-separated taxon ids. Accepts a single value or
          an array (joined with commas).
        listStyle: comma
      taxon_id:
        description: >
          This taxon and all of its descendants (live-verified: `taxon_id`
          6930 returns the species plus its 3 child taxa).
      parent_id:
        description: Taxon's parent must have this id (immediate children only).
      rank:
        description: >
          Taxon must have this rank (single value: `species`, `genus`,
          `family`, …).
      rank_level:
        description: >
          Taxon must have this rank level (e.g. 10 = species, 20 = genus,
          30 = family).
      is_active:
        description: "`false` to include inactive (conservative) taxa."
  - name: getTaxon
    via: restGet
    path: /v1/taxa/{id}
    accept: json
    params:
      id:
        description: >
          Taxon id. Same list envelope — the object sits under `results[0]`.
  - name: autocompleteTaxa
    via: paginate
    path: /v1/taxa/autocomplete
    accept: json
    passthrough: true
    params:
      q:
        required: true
        description: >
          Name prefix (must start with this value; an id matches exactly).
          Required for results — without it the endpoint returns an empty
          page (live-verified).
      per_page:
        description: Results per page — the documented maximum for this endpoint is 30.
      all_names:
        description: "`true` includes all common names in each result."

  # ── Group D — Places ──────────────────────────────────────────────
  - name: autocompletePlaces
    via: paginate
    path: /v1/places/autocomplete
    accept: json
    passthrough: true
    params:
      q:
        required: true
        description: >
          Place-name prefix. Without it the endpoint returns an empty page
          (live-verified).
  - name: listNearbyPlaces
    via: restGet
    path: /v1/places/nearby
    accept: json
    params:
      nelat:
        description: >
          Bounding-box north-east latitude. The endpoint filters by bbox
          (`nelat`/`nelng`/`swlat`/`swlng`) — live probes showed plain
          `lat`/`lng` are ignored — and falls back to a default region
          when no bbox is given.
      nelng:
        description: Bounding-box north-east longitude.
      swlat:
        description: Bounding-box south-west latitude.
      swlng:
        description: Bounding-box south-west longitude.
      name:
        description: Filter to places whose name matches this string.
      per_page:
        description: >
          Results per place group. NOTE the response shape differs here:
          `results` is an OBJECT with two arrays — `standard` and
          `community` places — not a flat list.
  - name: getPlace
    via: restGet
    path: /v1/places/{id}
    accept: json
    params:
      id:
        description: >
          Place id (e.g. `1` is the United States). Same list envelope —
          the object sits under `results[0]`.

  # ── Group E — Projects ────────────────────────────────────────────
  - name: listProjects
    via: paginate
    path: /v1/projects
    accept: json
    passthrough: true
    params:
      per_page:
        description: >
          Results per page — the API caps this at 300, and `total_results`
          is capped at 10000 regardless of the true match count. Filter
          before walking (see the guide prose below).
      q:
        description: Title/description search.
      featured:
        description: "`true` for site-featured projects only."
      noteworthy:
        description: "`true` for noteworthy projects."
      type:
        description: Comma-separated project types (`collection`, `umbrella`).
      lat:
        description: Latitude for a radius search — pair with lng and radius.
      lng:
        description: Longitude for a radius search.
      projects_radius:
        description: Radius in km around lat/lng (max 500).
      member_id:
        description: Projects this user belongs to.
  - name: autocompleteProjects
    via: paginate
    path: /v1/projects/autocomplete
    accept: json
    passthrough: true
    params:
      q:
        required: true
        description: >
          Project-title prefix. Without it the endpoint returns an empty
          page (live-verified).
  - name: getProject
    via: restGet
    path: /v1/projects/{id}
    accept: json
    params:
      id:
        description: >
          Project id (e.g. `5` is Hawaii Sea Turtle Monitoring). NOTE many
          low ids no longer exist — project `1` returns an empty results
          array, not an error (live-verified); check `total_results`.
  - name: listProjectMembers
    via: paginate
    path: /v1/projects/{id}/members
    accept: json
    passthrough: true
    params:
      id:
        description: Project id.
      role:
        description: "`curator` or `manager` to filter membership roles."
      per_page:
        description: Results per page (rows are project-membership records).

  # ── Group F — Global search ───────────────────────────────────────
  - name: search
    via: paginate
    path: /v1/search
    accept: json
    passthrough: true
    params:
      q:
        required: true
        description: >
          Search string. Required for results — without it the endpoint
          returns an empty page (live-verified).
      sources:
        description: >
          Comma-separated object types to search: `taxa`, `observations`,
          `places`, `projects`, `users`. Default searches all.
      per_page:
        description: >
          Results per page — the API caps this endpoint at 100. Rows are
          `{score, type, record}` matches; `total_results` is capped at
          10000.

  # ── Group G — Users ───────────────────────────────────────────────
  - name: autocompleteUsers
    via: paginate
    path: /v1/users/autocomplete
    accept: json
    passthrough: true
    params:
      q:
        required: true
        description: >
          Login or real-name prefix. Without it the endpoint returns an
          empty page (live-verified).
      per_page:
        description: >
          Results per page (server default 5). Values near 100 have been
          observed to return empty pages live — keep this small (≤ 20).
  - name: getUser
    via: restGet
    path: /v1/users/{id}
    accept: json
    params:
      id:
        description: >
          User id or login (e.g. `1` is kueda, the site director). Same
          list envelope — the object sits under `results[0]`.
  - name: listUserProjects
    via: paginate
    path: /v1/users/{id}/projects
    accept: json
    passthrough: true
    params:
      id:
        description: User id or login.
      per_page:
        description: Results per page (rows are project objects the user belongs to).

  # ── Group H — Community content ───────────────────────────────────
  # /v1/posts returns a BARE ARRAY (no envelope) — the page style cannot
  # address it, so the recipe exposes a single page via restGet. The
  # server still accepts page/per_page, but only the first page is
  # reachable through this recipe.
  - name: listPosts
    via: restGet
    path: /v1/posts
    accept: json
    params:
      page:
        description: >
          Page number (response is a bare array — only the requested page's
          posts, no total_results envelope).

  # ── Group I — Controlled terms (annotation vocabulary) ────────────
  - name: listControlledTerms
    via: paginate
    path: /v1/controlled_terms
    accept: json
  - name: listTaxonControlledTerms
    via: paginate
    path: /v1/controlled_terms/for_taxon
    accept: json
    params:
      taxon_id:
        required: true
        description: >
          Taxon id (required — the server 422s without it). Returns the
          controlled terms valid for annotations on this taxon's
          observations (often an empty list for taxa without custom
          vocabularies).

  # ── Group J — Geomodel tiles (grid JSON) ──────────────────────────
  # These are web-mercator TILES, not lists: {zoom}/{x}/{y} are standard
  # slippy-map tile coordinates (zoom 0–10ish, x/y in [0, 2^zoom)). Each
  # returns a compact ASCII intensity grid (one character per cell; the
  # character code encodes density — see the response's `grid` array of
  # strings). The .png variants of the same routes are binary and out of
  # scope for this JSON recipe.
  - name: getObservationGrid
    via: restGet
    path: /v1/grid/{zoom}/{x}/{y}.grid.json
    accept: json
    params:
      zoom:
        description: Web-mercator zoom level.
      x:
        description: Tile x coordinate (0 to 2^zoom - 1).
      y:
        description: Tile y coordinate (0 to 2^zoom - 1).
  - name: getHeatmapGrid
    via: restGet
    path: /v1/heatmap/{zoom}/{x}/{y}.grid.json
    accept: json
    params:
      zoom:
        description: Web-mercator zoom level.
      x:
        description: Tile x coordinate.
      y:
        description: Tile y coordinate.
  - name: getColoredHeatmapGrid
    via: restGet
    path: /v1/colored_heatmap/{zoom}/{x}/{y}.grid.json
    accept: json
    params:
      zoom:
        description: Web-mercator zoom level.
      x:
        description: Tile x coordinate.
      y:
        description: Tile y coordinate.
  - name: getPointsGrid
    via: restGet
    path: /v1/points/{zoom}/{x}/{y}.grid.json
    accept: json
    params:
      zoom:
        description: Web-mercator zoom level.
      x:
        description: Tile x coordinate.
      y:
        description: Tile y coordinate.
---
# iNaturalist

The iNaturalist Node API (`api.inaturalist.org/v1`) serves the observation
data behind iNaturalist.org — a global biodiversity community where
naturalists record, identify, and discuss observations of organisms. No
authentication is required for any operation in this guide.

## Endpoint map

- **Observations** — the core stream (`listObservations`, keyset-paginated)
  plus per-observation reads, a histogram endpoint, and three stats
  endpoints (species counts, identifiers, observers, popular field values).
- **Identifications** — the ID stream and its stats mirrors
  (`identifiers`, `observers`, `species_counts`, `recent_taxa`,
  `similar_species`, `categories`).
- **Taxa** — the taxonomy backbone (`listTaxa`, `getTaxon`,
  `autocompleteTaxa`).
- **Places** — autocomplete, nearby, and place detail.
- **Projects** — collection/umbrella projects, their members, autocomplete.
- **Search** — one cross-entity search endpoint (`taxa`, `observations`,
  `places`, `projects`, `users`).
- **Users** — autocomplete, profile detail, a user's projects.
- **Controlled terms** — the annotation vocabulary (`listControlledTerms`
  is the key to reading annotation filters).
- **Geomodel tiles** — ASCII intensity grids for observations, heatmaps,
  and points at web-mercator `{zoom}/{x}/{y}` coordinates.

Auth-gated endpoints (messages, `users/me`, `observations/updates`,
`observations/deleted`, subscriptions, `projects/{id}/membership`) are out
of scope for this no-auth guide, as are the binary `.png` tile variants of
the grid routes.

## Pagination

Two shapes live in this guide:

1. **`page` style (guide default)** — nearly every list endpoint returns
   `{total_results, page, per_page, results: [...]}` and paginates with
   `?page=N&per_page=M`. Declared at guide level; all paginate ops except
   `listObservations` inherit it. `total_results` surfaces as
   `serverTotal` in gather results and is a free progress meter.
2. **Derived-id cursor (listObservations only)** — see the next section.

### The 10000-record result window (ES-backed endpoints)

The observation/taxon/identification/search/project indexes are
Elasticsearch-backed and enforce a **hard result window: page × per_page
must be ≤ 10000**. Beyond it the server returns HTTP 403 with
`"Result window is too large, page x size must be less than or equal to
[10000]"` — the error text explicitly recommends "a sliding window
approach with id_above or id_below" (the keyset walk `listObservations`
implements). `listTaxa` and `listIdentifications` genuinely accept those
`id_above`/`id_below` keyset params, so a deep walk past the window can
feed the last item's id back manually — the same shape `listObservations`
automates. The guide's `gatherAllMax: 1000` keeps default walks safely
inside the window; raise it deliberately (never past 10000) and only for
filtered, small-`per_page` walks. Per-endpoint `per_page` caps vary and are
declared on each op (observations/identifications 200, projects 300,
search 100, taxa/autocomplete 30).

## The derived-id cursor

`listObservations` paginates by **keyset on the observation id**: each
response carries `results` plus the server-wide `total_results` count, and
the continuation value for the next page is **the last item's `id`** fed
back as the `id_above` query param ("must have an ID above this value").

This is the dominant live numeric-cursor pattern on the web: the API has no
dedicated continuation field — the cursor value *is* an item field, derived
from the previous page's final row. The recipe expresses it with a
negative-index path:

- `cursorPath: "results[-1].id"` — `[-1]` addresses the **last element** of
  `results` (negative indexes count from the end of the array). On a
  short-but-nonempty page (e.g. 3 items), `results[-1]` is item 3 — a static
  index like `results[29]` would silently miss and stop the walk early.
- `cursorParam: id_above` — the resolved id is coerced to a query string on
  the wire (`?id_above=396883275`).
- **`order_by: id` + `order: asc` is load-bearing — and both are declared
  op defaults, so the walk sends them on every page.** With ascending id order
  and `id_above` (strictly "id > cursor"), every page picks up exactly where
  the previous one stopped — no overlap, no gap, even while new observations
  stream in. Do not switch to `order: desc`: with descending order,
  `id_above` would re-fetch the pages you just read (the "above the cursor"
  region is the newest rows — which is where page 1 lives). A backward walk
  through history would need `id_below`, which is a different cursorParam.
- **End marker:** past the last observation the API returns an **empty
  `results` array** (`[]`, live-verified — not a `0` sentinel). `results[-1]`
  on the empty array is a clean miss, so the gather walk terminates by
  itself; there is no cursor value to feed back.
- **No result window** — the keyset walk is the *only* unbounded way to
  walk the full observation stream (the error message for the ES window on
  other endpoints points here).

`total_results` is the server-wide match count (~3.8×10⁸ for the unfiltered
stream — it moves as observations arrive) and surfaces as `serverTotal` in
gather results. With a filter applied it is the filtered count and a free
progress meter.

## Response-shape quirks

- **Single entities wrap in the list envelope.** `getObservation`,
  `getTaxon`, `getPlace`, `getIdentification`, `getUser`, `getProject` all
  return `{total_results: 1, results: [<object>]}` — the object is under
  `results[0]`, not at the top level.
- **Two endpoints return non-array `results`:** `getObservationHistogram`
  (a bucket-key → count object) and `listNearbyPlaces`
  (`{standard: [...], community: [...]}`) — both are `restGet` for that
  reason, and `listPosts` returns a **bare array** (no envelope at all).
- **Autocompletes require `q`** — without it they return a 200 with an
  empty page (not an error). Declared `required: true` so the agent
  fails fast.
- **Deleted/dead ids vary by endpoint:** a nonexistent observation returns
  an empty `results` array with HTTP 200; project ids are recycled (project
  `1` is empty, project `5` lives). Check `total_results` before assuming
  an id exists.

## Payload weight

Observation and identification objects are **heavy**: each embeds the full
taxon and user objects, photo metadata, and annotation arrays (tens of KB
per row). The sparse-fieldset parameters often seen on this API family
(`fields`, `only_id`) are **not honored** on this endpoint — live probes
return full objects regardless — so the only lever is page size. Keep
`per_page` at or under 50 for gather walks and lean on `taxon_name` /
`place_id` filters to bound the result set before pulling.

## Terms

Data is licensed individually by contributors (CC0/CC-BY/CC-BY-NC variants —
check each observation's `license_code`). Respect the community: pace your
requests, keep pages small, and cite iNaturalist and the individual
observers in derived work. See
<https://www.inaturalist.org/pages/terms>.
