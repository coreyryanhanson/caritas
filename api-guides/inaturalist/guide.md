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
verified: "2026-09-03"
docs: https://api.inaturalist.org/v1/docs/
operations:
  - name: listObservations
    via: paginate
    path: /v1/observations
    accept: json
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
        description: Sort field.
        default: id
      order:
        description: >
          Sort order. Both defaults are load-bearing for the derived-id
          keyset walk (see the guide prose below) — override the sort and
          the walk breaks.
        default: asc
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
      taxon_name:
        description: >
          Taxon must have a scientific or common name matching this string
          (e.g. `Danaus plexippus`). Multiple values may be comma-separated.
      place_id:
        description: >
          Must be observed within the place with this ID (e.g. `1` is the
          United States). Multiple values may be comma-separated.
---
# iNaturalist

The iNaturalist Node API (`api.inaturalist.org/v1`) serves the observation
data behind iNaturalist.org — a global biodiversity community where
naturalists record, identify, and discuss observations of organisms. No
authentication is required for read endpoints.

## Operations

### `listObservations` — Search observations

Returns a page of observations matching the given filters, each with its
full embedded payload: quality grade, coordinates, taxon object, user
object, photos, annotations, and more. Use the filters to narrow the
result set; pass `gatherAll: true` to `api-fetch` to walk the full result
set (bounded by the gather ceiling).

**Parameters:** `per_page` (≤200, default 30), `order_by` (default `id`),
`order` (default `asc` — both required for the stable walk and baked in as
declared defaults), plus any combination of `q`, `taxon_name`, and
`place_id`. All optional — omit everything to walk the global observation
stream from its oldest observation.

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

`total_results` is the server-wide match count (~3.8×10⁸ for the unfiltered
stream — it moves as observations arrive) and surfaces as `serverTotal` in
gather results. With a filter applied it is the filtered count and a free
progress meter.

## Payload weight

Observation objects are **heavy**: each embeds the full taxon and user
objects, photo metadata, and annotation arrays (tens of KB per row). The
sparse-fieldset parameters often seen on this API family (`fields`,
`only_id`) are **not honored** on this endpoint — live probes return full
objects regardless — so the only lever is page size. Keep `per_page` at or
under 50 for gather walks and lean on `taxon_name` / `place_id` filters to
bound the result set before pulling.

## Terms

Data is licensed individually by contributors (CC0/CC-BY/CC-BY-NC variants —
check each observation's `license_code`). Respect the community: pace your
requests, keep pages small, and cite iNaturalist and the individual
observers in derived work. See
<https://www.inaturalist.org/pages/terms>.
