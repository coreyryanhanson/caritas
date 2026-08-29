---
kind: api
schemaVersion: 1
domains:
  - twitch.tv
shortName: Twitch
icon: 🎮
apiHost: https://api.twitch.tv
auth:
  # client_credentials: Helix app-token reads (public data, no user context).
  # App tokens cannot be refreshed — on expiry resolveAccessToken re-mints.
  kind: oauth2
  grant: client_credentials
  tokenUrl: https://id.twitch.tv/oauth2/token
  clientId:
    secret: client_id
  clientSecret:
    secret: client_secret
  tokenEndpointAuthMethod: client_secret_post
  secretRefs:
    Client-Id:
      secret: client_id
responseShape:
  format: json
  charset: utf-8
verified: "2026-08-29"
docs: https://dev.twitch.tv/docs/api/
operations:
  # ── Starter op — smoke-tests the oauth2 pipeline end to end ──────
  - name: topGames
    via: paginate
    path: /helix/games/top
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
    params:
      first:
        description: Maximum number of items per page (1–100).
      after:
        description: Cursor for forward pagination.
---

# Notes

- App access tokens are not refreshable (Twitch docs: "You cannot refresh app
  access tokens") — the resolver re-mints on expiry instead of refreshing.
- Helix requires the `Client-Id` header on every request in addition to the
  Bearer token; both resolve from the same `client_id` store secret.
- Recipe reads public game/streams metadata only — no user-context Helix
  scopes, no chat data.
