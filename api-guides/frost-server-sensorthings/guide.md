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
  # ── Group A — Entity-set collections (all paginate via @iot.nextLink) ──
  # Every SensorThings entity set paginates the same OData-style way: a
  # literal top-level `@iot.nextLink` (dotted key — hence the quoted-bracket
  # paths) and, with `$count=true`, a numeric `@iot.count` total. `$top`
  # sizes the page (server default 20); `$count` is on by default so
  # gathered walks know how much is left. All OData v4 system query options
  # ($filter, $orderby, $select, $expand, $resultFormat, …) flow through
  # via `passthrough: true`.
  - name: listThings
    via: paginate
    path: /Things
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size (SensorThings `$top`). Server default is 20.
      $count:
        default: true
        description: >
          Include the server-reported total (`@iot.count`) in the response —
          surfaced as `serverTotal`. The recipe sets it on by default so
          gathered walks know how much is left.
  - name: listDatastreams
    via: paginate
    path: /Datastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listLocations
    via: paginate
    path: /Locations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listSensors
    via: paginate
    path: /Sensors
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listObservedProperties
    via: paginate
    path: /ObservedProperties
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listFeaturesOfInterest
    via: paginate
    path: /FeaturesOfInterest
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listHistoricalLocations
    via: paginate
    path: /HistoricalLocations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listMultiDatastreams
    via: paginate
    path: /MultiDatastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listObservations
    via: paginate
    path: /Observations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).

  # ── Group B — Single entities by id ───────────────────────────────
  - name: getThing
    via: restGet
    path: /Things({thingId})
    accept: json
    passthrough: true
  - name: getDatastream
    via: restGet
    path: /Datastreams({datastreamId})
    accept: json
    passthrough: true
  - name: getLocation
    via: restGet
    path: /Locations({locationId})
    accept: json
    passthrough: true
  - name: getSensor
    via: restGet
    path: /Sensors({sensorId})
    accept: json
    passthrough: true
  - name: getObservedProperty
    via: restGet
    path: /ObservedProperties({observedPropertyId})
    accept: json
    passthrough: true
  - name: getFeatureOfInterest
    via: restGet
    path: /FeaturesOfInterest({featureOfInterestId})
    accept: json
    passthrough: true
  - name: getHistoricalLocation
    via: restGet
    path: /HistoricalLocations({historicalLocationId})
    accept: json
    passthrough: true
  - name: getMultiDatastream
    via: restGet
    path: /MultiDatastreams({multiDatastreamId})
    accept: json
    passthrough: true
  - name: getObservation
    via: restGet
    path: /Observations({observationId})
    accept: json
    passthrough: true

  # ── Group C — Collection navigations (paginate) ───────────────────
  # `/{Entity}(id)/{Related}` — the SensorThings association graph. Each
  # returns a `value` array with the same `@iot.nextLink` pagination.
  # Things(1)/Locations is O(1) in practice (a Thing has 1 current
  # location); Datastreams(id)/Observations is a deep time-series walk
  # (~300k rows for Datastream 1 — let gatherAllMax bound it, or prefer
  # $filter/$top).
  - name: listThingDatastreams
    via: paginate
    path: /Things({thingId})/Datastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listThingMultiDatastreams
    via: paginate
    path: /Things({thingId})/MultiDatastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listThingLocations
    via: paginate
    path: /Things({thingId})/Locations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listThingHistoricalLocations
    via: paginate
    path: /Things({thingId})/HistoricalLocations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listLocationThings
    via: paginate
    path: /Locations({locationId})/Things
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listLocationHistoricalLocations
    via: paginate
    path: /Locations({locationId})/HistoricalLocations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listHistoricalLocationLocations
    via: paginate
    path: /HistoricalLocations({historicalLocationId})/Locations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listDatastreamObservations
    via: paginate
    path: /Datastreams({datastreamId})/Observations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listSensorDatastreams
    via: paginate
    path: /Sensors({sensorId})/Datastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listSensorMultiDatastreams
    via: paginate
    path: /Sensors({sensorId})/MultiDatastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listObservedPropertyDatastreams
    via: paginate
    path: /ObservedProperties({observedPropertyId})/Datastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listObservedPropertyMultiDatastreams
    via: paginate
    path: /ObservedProperties({observedPropertyId})/MultiDatastreams
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listFeatureOfInterestObservations
    via: paginate
    path: /FeaturesOfInterest({featureOfInterestId})/Observations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listMultiDatastreamObservations
    via: paginate
    path: /MultiDatastreams({multiDatastreamId})/Observations
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).
  - name: listMultiDatastreamObservedProperties
    via: paginate
    path: /MultiDatastreams({multiDatastreamId})/ObservedProperties
    accept: json
    passthrough: true
    params:
      $top:
        description: Page size. Server default is 20.
      $count:
        default: true
        description: Include `@iot.count` (surfaced as `serverTotal`).

  # ── Group D — Single-entity navigations (restGet) ─────────────────
  # The to-one side of each association: exactly one entity, no pagination.
  - name: getHistoricalLocationThing
    via: restGet
    path: /HistoricalLocations({historicalLocationId})/Thing
    accept: json
  - name: getDatastreamThing
    via: restGet
    path: /Datastreams({datastreamId})/Thing
    accept: json
  - name: getDatastreamSensor
    via: restGet
    path: /Datastreams({datastreamId})/Sensor
    accept: json
  - name: getDatastreamObservedProperty
    via: restGet
    path: /Datastreams({datastreamId})/ObservedProperty
    accept: json
  - name: getMultiDatastreamThing
    via: restGet
    path: /MultiDatastreams({multiDatastreamId})/Thing
    accept: json
  - name: getMultiDatastreamSensor
    via: restGet
    path: /MultiDatastreams({multiDatastreamId})/Sensor
    accept: json
  - name: getObservationDatastream
    via: restGet
    path: /Observations({observationId})/Datastream
    accept: json
  - name: getObservationFeatureOfInterest
    via: restGet
    path: /Observations({observationId})/FeatureOfInterest
    accept: json

  # ── Group E — Raw value ───────────────────────────────────────────
  - name: getObservationRawResult
    via: restGet
    path: /Datastreams({datastreamId})/Observations({observationId})/result/$value
    accept: json
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

## The data model

Eight entity types (9 sets — `MultiDatastream` is the v1.1 extension):

- **Things** — monitoring stations (here: EEA air-quality stations with a
  rich `properties` metadata bag: country, area type, measurement regime).
- **Datastreams** — link a Thing + Sensor + ObservedProperty into a time
  series; carries `unitOfMeasurement` and `observedArea` (GeoJSON geometry).
- **MultiDatastreams** — v1.1 extension: one stream with multiple
  observation data types.
- **Sensors** — measurement-method descriptions (equipment vocab URIs).
- **ObservedProperties** — what is measured (pollutant vocab URIs).
- **Observations** — the measurements themselves (`phenomenonTime`,
  `result`). The biggest collection by far (~1.0 billion rows on this
  instance).
- **FeaturesOfInterest** — the sampled feature (GeoJSON point).
- **Locations / HistoricalLocations** — station locations and their history.

Navigation graph (every association below is a declared op above):

| From | To-many (paginate) | To-one (restGet) |
|------|--------------------|------------------|
| Thing | Datastreams, MultiDatastreams, Locations, HistoricalLocations | — |
| Location | Things, HistoricalLocations | — |
| HistoricalLocation | Locations | Thing |
| Datastream | Observations | Thing, Sensor, ObservedProperty |
| MultiDatastream | Observations, ObservedProperties | Thing, Sensor |
| Sensor | Datastreams, MultiDatastreams | — |
| ObservedProperty | Datastreams, MultiDatastreams | — |
| FeatureOfInterest | Observations | — |
| Observation | — | Datastream, FeatureOfInterest |

## Query options (passthrough)

All OData v4 system query options are forwarded on any op via
`passthrough: true` — declare nothing, just pass them:

- `$filter` — OData filter, e.g. `properties/countryCode eq 'DE'` (note:
  forward-slash property paths and URL-encode spaces).
- `$orderby` — e.g. `phenomenonTime desc`.
- `$select` — comma-separated property whitelist (slashes for nested,
  e.g. `properties/countryCode`).
- `$expand` — inline related entities, e.g. `Sensor($select=name)`.
- `$resultFormat` — FROST extension: `GeoJSON` on entity sets with a
  geometry (`Locations`, `Things`, `FeaturesOfInterest`, `Datastreams`)
  returns a GeoJSON FeatureCollection (flat `properties/…` keys).

Declared params are only `$top` (page size) and `$count` (on by default —
`totalCountPath` resolves nothing without it).

## Pagination

`nextLink` style: each page's body carries `@iot.nextLink` (absolute URL to
the next page) and, with `$count=true`, `@iot.count` (total). `gatherAll:
true` follows the chain until the server stops emitting `@iot.nextLink`,
bounded by `gatherAllMax` (default 1000). The first page sends your declared
params; subsequent pages follow the server's nextLink URLs verbatim.

All collection ops — entity sets **and** navigations — share this pagination
via the guide-level block. The `@iot.count` from a filtered or navigated
collection is that collection's total, not the global one.

## Notes & quirks

- **`$metadata` is disabled on this instance** (404). Use the root document
  (`GET /v1.1/`) for the entity-set → URL map, and each entity's
  `@iot.navigationLink` values for its associations.
- **Raw values**: `getObservationRawResult` returns the bare measurement
  number (`Content-Type: application/json`, body is a lone JSON number).
- **Property-level access** (`/Things(id)/name` → `{"name": …}`) is
  expressible in SensorThings but not declared as ops — the single-entity
  ops already carry every property; prefer `$select` to slim them.
- **Big collections**: `Observations` is a deep time-series store (~1.0B
  rows) — a `gatherAll` on it unbounded is effectively unbounded. Filter by
  Datastream (its own series is still ~300k for a long-lived station) and
  let `gatherAllMax` bound the drain. The server pins nextLink pages with
  an internal `$orderby=@iot.id asc` keyset, so walks are stable and
  non-overlapping.
- **Sub-resources are first-class collections**: `listDatastreamObservations`
  paginates identically to `listObservations` (same `@iot.nextLink` shape,
  same `$count=true` → `@iot.count`).
