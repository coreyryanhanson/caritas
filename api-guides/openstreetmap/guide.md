---
kind: api
schemaVersion: 1
description: >-
  OpenStreetMap API v0.6 read-only endpoints — map data (nodes/ways/relations),
  changesets, map notes, users, and GPS traces. Public reads work for any
  OAuth2-authorized client; user-scoped reads (own details, preferences, GPS
  traces) use the read_prefs / read_gpx scopes.
domains:
  - openstreetmap.org
shortName: OpenStreetMap
icon: 🗺️
apiHost: https://api.openstreetmap.org
auth:
  # authorization_code + PKCE. Only OAuth2 is supported by OSM (Basic auth and
  # OAuth 1.0a were shut down June 2024). The token lives in its own slot —
  # (openstreetmap.org, authorization_code, tokenUrl). OSM access tokens
  # currently do not expire, so there is no refresh-token lifecycle in
  # practice (the resolver handles it if OSM ever returns one).
  # The Bearer rides every call — public endpoints ignore it, user-scoped
  # reads (me, myTraces, myPreferences) require it.
  kind: oauth2
  grant: authorization_code
  tokenUrl: https://www.openstreetmap.org/oauth2/token
  authorizeUrl: https://www.openstreetmap.org/oauth2/authorize
  clientId:
    secret: client_id
  clientSecret:
    secret: client_secret
  tokenEndpointAuthMethod: client_secret_post
  scopes:
    - read_prefs
    - read_gpx
responseShape:
  format: json
  charset: utf-8
verified: "2026-08-30"
docs: https://wiki.openstreetmap.org/wiki/API_v0.6
operations:
  # ── Miscellaneous ────────────────────────────────────────────────
  - name: versions
    via: restGet
    path: /api/versions
    accept: json
    params: {}
  - name: capabilities
    via: restGet
    path: /api/0.6/capabilities
    accept: json
    params: {}
  # Tiny bboxes only — the API rejects > 50,000 nodes with 400 and heavy
  # pulls with 509 Bandwidth Limit Exceeded (OSMF usage policy).
  - name: map
    via: restGet
    path: /api/0.6/map.json
    accept: json
    params:
      bbox:
        description: Bounding box as left,bottom,right,top (lon,lat,lon,lat degrees). Beware the 50,000-node limit — keep the box small.
        required: true
  # Echoes the granted OAuth scopes as allow_* permissions (empty when unauthenticated).
  - name: permissions
    via: restGet
    path: /api/0.6/permissions.json
    accept: json
    params: {}
  # ── Changesets ───────────────────────────────────────────────────
  # Query: filter changesets. Multiple filters AND together; at most 100
  # returned (no pagination — use tighter filters instead).
  - name: changesets
    via: restGet
    path: /api/0.6/changesets.json
    accept: json
    params:
      bbox:
        description: Changesets within the bbox (min_lon,min_lat,max_lon,max_lat — W,S,E,N).
      user:
        description: Changesets by the user with this uid (mutually exclusive with display_name).
      display_name:
        description: Changesets by the user with this display name (mutually exclusive with user).
      time:
        description: "T1 — changesets closed after T1; or T1,T2 — open at some point in that range."
      from:
        description: Find changesets created at or after T1 (with optional to=T2).
      to:
        description: Changesets created before T2 (requires from).
      open:
        description: "true — only still-open changesets."
      closed:
        description: "true — only closed changesets."
      changesets:
        description: Comma-separated changeset ids to fetch.
      order:
        description: newest (default) or oldest. Cannot combine with time.
      limit:
        description: Maximum number of changesets (1–100, default 100).
  - name: changeset
    via: restGet
    path: /api/0.6/changeset/{id}.json
    accept: json
    params:
      id:
        description: The changeset id to read.
      include_discussion:
        description: Set to any value to include the changeset discussion (comments).
  # Full osmChange diff of the changeset (XML only — no JSON form).
  - name: changesetDownload
    via: restGet
    path: /api/0.6/changeset/{id}/download
    accept: xml
    parse:
      format: xml
    params:
      id:
        description: The changeset id whose osmChange diff to download.
  # Search changeset comments; no query → most recent comments globally.
  - name: changesetComments
    via: restGet
    path: /api/0.6/changeset_comments.json
    accept: json
    params:
      display_name:
        description: Comments created by this display name (mutually exclusive with user).
      user:
        description: Comments by this user id (display_name wins if both given).
      from:
        description: Beginning date range (ISO 8601).
      to:
        description: End date range (requires from).
  # ── Elements (map data) ──────────────────────────────────────────
  # type is node|way|relation for every element op below.
  - name: element
    via: restGet
    path: /api/0.6/{type}/{id}.json
    accept: json
    params:
      type:
        description: Element type — node, way, or relation.
      id:
        description: The element id.
  - name: elementHistory
    via: restGet
    path: /api/0.6/{type}/{id}/history.json
    accept: json
    params:
      type:
        description: Element type — node, way, or relation.
      id:
        description: The element id.
  - name: elementVersion
    via: restGet
    path: /api/0.6/{type}/{id}/{version}.json
    accept: json
    params:
      type:
        description: Element type — node, way, or relation.
      id:
        description: The element id.
      version:
        description: Specific version number (403 when redacted).
  - name: elementRelations
    via: restGet
    path: /api/0.6/{type}/{id}/relations.json
    accept: json
    params:
      type:
        description: Element type — node, way, or relation.
      id:
        description: The element id. Empty result (not an error) when unused/nonexistent.
  # way|relation only — the element plus everything it references.
  - name: elementFull
    via: restGet
    path: /api/0.6/{type}/{id}/full.json
    accept: json
    params:
      type:
        description: Element type — way or relation (full is not defined for nodes).
      id:
        description: The element id.
  # All (not deleted) ways that use this node. Empty result when unused.
  - name: nodeWays
    via: restGet
    path: /api/0.6/node/{id}/ways.json
    accept: json
    params:
      id:
        description: The node id.
  # Multi-fetch: comma-separated ids (optionally with v# versions); 404 if
  # any element never existed (deleted ones return visible="false").
  - name: fetchNodes
    via: restGet
    path: /api/0.6/nodes.json
    accept: json
    params:
      nodes:
        description: Comma-separated node ids (optionally suffixed v1, v2… — CGImap only).
        required: true
  - name: fetchWays
    via: restGet
    path: /api/0.6/ways.json
    accept: json
    params:
      ways:
        description: Comma-separated way ids.
        required: true
  - name: fetchRelations
    via: restGet
    path: /api/0.6/relations.json
    accept: json
    params:
      relations:
        description: Comma-separated relation ids.
        required: true
  # ── GPS traces ───────────────────────────────────────────────────
  # GPX 1.0 track points in a bbox (max 0.25° × 0.25°, 5,000 points per
  # page — page is a 0-based group index, not OSM's usual semantics).
  - name: trackpoints
    via: restGet
    path: /api/0.6/trackpoints
    accept: xml
    parse:
      format: xml
    params:
      bbox:
        description: Bounding box left,bottom,right,top — max 0.25° per side.
        required: true
      page:
        description: 0-based 5,000-point page number.
        default: 0
  - name: gpxMetadata
    via: restGet
    path: /api/0.6/gpx/{id}.json
    accept: json
    params:
      id:
        description: The GPS trace id (public traces need no auth; private ones need read_gpx + ownership).
  - name: gpxData
    via: restGet
    path: /api/0.6/gpx/{id}/data.gpx
    accept: xml
    parse:
      format: xml
    params:
      id:
        description: The GPS trace id (public traces need no auth; private ones need read_gpx + ownership).
  # Own GPS traces (read_gpx scope). /user/ here is literal, not a user id.
  - name: myTraces
    via: restGet
    path: /api/0.6/user/gpx_files.json
    accept: json
    params: {}
  # ── User data ────────────────────────────────────────────────────
  # The token's own user: display name, home location, image, message counts
  # (requires read_prefs).
  - name: me
    via: restGet
    path: /api/0.6/user/details.json
    accept: json
    params: {}
  - name: myPreferences
    via: restGet
    path: /api/0.6/user/preferences.json
    accept: json
    params: {}
  # Non-empty user_blocks array only when the token's user is currently blocked.
  - name: myActiveBlocks
    via: restGet
    path: /api/0.6/user/blocks/active.json
    accept: json
    params: {}
  - name: user
    via: restGet
    path: /api/0.6/user/{id}.json
    accept: json
    params:
      id:
        description: The user id (home location + display name).
  # Skips non-existent/suspended/deleted users (no 404 since 2023-08).
  - name: users
    via: restGet
    path: /api/0.6/users.json
    accept: json
    params:
      users:
        description: Comma-separated user ids.
        required: true
  # ── Map notes ────────────────────────────────────────────────────
  - name: notes
    via: restGet
    path: /api/0.6/notes.json
    accept: json
    params:
      bbox:
        description: Bounding box left,bottom,right,top — at most 25 square degrees.
        required: true
      limit:
        description: Max entries (1–10000, default 100).
      closed:
        description: Days a note must be closed to be omitted — 0 = open only, -1 = all (default 7).
  - name: note
    via: restGet
    path: /api/0.6/notes/{id}.json
    accept: json
    params:
      id:
        description: The map note id (410 when hidden by a moderator).
  - name: notesSearch
    via: restGet
    path: /api/0.6/notes/search.json
    accept: json
    params:
      q:
        description: Text query matching note text or comments (no query → most recently updated).
      limit:
        description: Maximum results (1–10000, default 100).
      closed:
        description: Max days a note has been closed; 0 = open only, negative = all.
      display_name:
        description: Notes the given user interacted with (display_name wins over user).
      user:
        description: Notes the given user id interacted with.
      bbox:
        description: Search area (≤ 25 square degrees).
      from:
        description: Beginning date range for created_at/updated_at (ISO 8601).
      to:
        description: End date range (requires from).
      sort:
        description: created_at or updated_at (default created_at).
      order:
        description: oldest or newest (default newest).
---

# Notes

- **Auth posture:** every operation is read-only. Public map-data reads
  (map, elements, changesets, notes) need no token at all; the guide's
  oauth2 auth block still attaches `Authorization: Bearer` to every call,
  which the API accepts on public endpoints. The user-scoped reads are
  `me` + `myPreferences` (`read_prefs` scope) and `myTraces` (`read_gpx`).
- Token provisioning: `/api oauth openstreetmap.org` (authorization_code
  paste flow, PKCE). Scopes minted for this guide: `read_prefs read_gpx`.
  Secrets store names: `client_id`, `client_secret`. OSM access tokens
  currently do not expire — no refresh expected.
- **JSON via `.json` suffix:** all JSON ops use the documented `.json` URL
  suffix; XML-only endpoints (`changesetDownload` = osmChange diff,
  `trackpoints` = GPX 1.0, `gpxData` = GPX) are declared `parse: {format: xml}`.
- **bbox format:** every bbox is `left,bottom,right,top` (W,S,E,N —
  lon,lat,lon,lat degrees). Size caps differ: map ~50k nodes, notes ≤ 25
  square degrees, trackpoints ≤ 0.25° per side.
- `map` rejects bboxes that would return > 50,000 nodes (400) and
  heavy downloads (509 Bandwidth Limit Exceeded). Keep test/agent bboxes
  city-block sized; the usage policy blocks clients hammering reads.
- **Empty signals:** `elementRelations` and `nodeWays` return an empty
  `<osm>`/`elements` document (HTTP 200) when the element is unused or
  missing — never an error. `trackpoints` pages are 0-based 5,000-point
  groups. Deleted elements still read via `fetchNodes`-style multi-fetch
  (`visible: false`), 404 only when never existing; `element`/`elementFull`
  answer 410 Gone for deleted elements.
- Excluded (write or mutation endpoints): changeset create/update/close,
  diff upload, element create/update/delete, note create/comment/close,
  redaction, everything PUT/POST/DELETE.
- Excluded (moderator/admin-gated): `GET /api/0.6/user_blocks/{id}` and the
  block-management endpoints (require `write_blocks`); changeset-comment
  hide/unhide.
- Excluded (no JSON form): `GET /api/0.6/notes/feed` (RSS only) and the
  GPX-trace upload endpoints. `GET /api/0.6/user/preferences/{key}` is
  readable but the key names are account-local — use `myPreferences` to
  list them first.
- Rate limits: OSMF publishes no numeric read limits; the documented 429
  applies to changeset uploads. OAuth2 does not improve read limits — be
  polite regardless (usage policy: <https://operations.osmfoundation.org/policies/api/>).
