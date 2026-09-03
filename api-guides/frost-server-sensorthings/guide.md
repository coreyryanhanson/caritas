---
kind: api
schemaVersion: 1
domains:
  - airquality-frost.k8s.ilt-dmz.iosb.fraunhofer.de
shortName: FROST-Server SensorThings
icon: 🌍
apiHost: https://airquality-frost.k8s.ilt-dmz.iosb.fraunhofer.de/v1.1
auth:
  kind: none
responseShape:
  format: json
  charset: utf-8
pagination:
  style: nextLink
  itemsPath: value
  nextLinkPath: "['@iot.nextLink']"
  totalCountPath: "['@iot.count']"
verified: "2026-09-03"
docs: https://fraunhoferiosb.github.io/FROST-Server/
operations:
  - name: listThings
    via: paginate
    path: /Things
    accept: json
    params:
      $top:
        description: Page size (SensorThings `$top`). Server default is 20.
      $count:
        default: true
        description: >
          Include the server-reported total (`@iot.count`) in the response —
          surfaced as `serverTotal`. The recipe sets it on by default so
          gathered walks know how much is left.
      $filter:
        description: OData filter, e.g. `properties/countryCode eq 'DE'`.
      $orderby:
        description: OData sort, e.g. `name asc`.
      $select:
        description: Comma-separated whitelist of properties to return.
---
# FROST-Server — OGC SensorThings API

[OGC SensorThings API](https://docs.ogc.org/is/18-088/18-088.html) served by
Fraunhofer IOSB's open-source [FROST-Server](https://fraunhoferiosb.github.io/FROST-Server/).
The listed instance is the public EEA air-quality deployment (measurement
stations and their datastreams) — no authentication.

## Why this recipe exists

FROST is the reference recipe for the **dotted-key pagination** shape: it
paginates OData-style via a literal top-level `@iot.nextLink` key — the dot
is part of the key name, not a path separator. The recipe therefore uses the
quoted-bracket path escape hatch:

- `nextLinkPath: "['@iot.nextLink']"` — quoted segment = one atomic key.
  The unquoted form `@iot.nextLink` would dot-split and silently miss,
  terminating pagination after page 1.
- `totalCountPath: "['@iot.count']"` — same family; numeric total surfaced
  as `serverTotal`.

This shape is spec-identical across all OData v4 services (Microsoft Graph's
`@odata.nextLink`, SharePoint, SAP OData), so recipes for those follow the
same pattern.

## Operations

### `listThings` — List measurement stations

Returns air-quality measurement stations (Things). Each carries `name`,
`description`, a `properties` bag (station metadata: country, area type,
measurement regime, …), and `@iot.navigationLink` URLs to its sub-resources
(`Datastreams`, `Locations`, `HistoricalLocations`).

**OData query params:** `$top` (page size), `$count` (server total; on by
default here), `$filter`, `$orderby`, `$select`. Follows the same
conventions as any OData v4 service — URL-encode `$` as `%24` only if your
client doesn't already treat it literally (api-fetch does).

### Navigating sub-resources

SensorThings entities link via `@iot.navigationLink` values inside each
item (e.g. `Datastreams@iot.navigationLink`). These are absolute URLs —
follow them with any HTTP client, or derive the path
(`/Things(1)/Datastreams`) for future ops. More sub-resource operations will
be added to this guide as it matures.

## Pagination

`nextLink` style: each page's body carries `@iot.nextLink` (absolute URL to
the next page) and, with `$count=true`, `@iot.count` (total). `gatherAll:
true` follows the chain until the server stops emitting `@iot.nextLink`,
bounded by `gatherAllMax` (default 1000). The first page sends your declared
params; subsequent pages follow the server's nextLink URLs verbatim.
