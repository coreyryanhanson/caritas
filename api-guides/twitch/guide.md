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
  # ── Streams & categories ─────────────────────────────────────────
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
  - name: games
    via: restGet
    path: /helix/games
    accept: json
    requiresAnyOf: [id, name, igdb_id]
    params:
      id:
        description: Game/category ID (up to 100, repeatable).
      name:
        description: Exact game/category title (up to 100, repeatable).
      igdb_id:
        description: IGDB ID of the game (up to 100, repeatable).
  - name: searchCategories
    via: paginate
    path: /helix/search/categories
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
    params:
      query:
        description: Search string (URI-encoding handled by the executor).
        required: true
      first:
        description: Maximum number of items per page (1–100).
      after:
        description: Cursor for forward pagination.
  - name: searchChannels
    via: paginate
    path: /helix/search/channels
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
    params:
      query:
        description: Search string (matches login, display name, description).
        required: true
      live_only:
        description: "true returns only channels currently live (default false)."
      first:
        description: Maximum number of items per page (1–100).
      after:
        description: Cursor for forward pagination.
  - name: streams
    via: paginate
    path: /helix/streams
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
    params:
      user_id:
        description: Filter by broadcaster user ID (up to 100, repeatable).
      user_login:
        description: Filter by broadcaster login name (up to 100, repeatable).
      game_id:
        description: Filter by game/category ID (up to 100, repeatable).
      language:
        description: ISO 639-1 language code (or "other").
      type:
        description: '"live" (default "all").'
      first:
        description: Maximum number of items per page (1–100, default 20).
      after:
        description: Cursor for forward pagination.
  # ── Users & channels ─────────────────────────────────────────────
  - name: users
    via: restGet
    path: /helix/users
    accept: json
    requiresAnyOf: [id, login]
    params:
      id:
        description: User ID (up to 100, repeatable).
      login:
        description: Login name (up to 100, repeatable).
  - name: channelInfo
    via: restGet
    path: /helix/channels
    accept: json
    params:
      broadcaster_id:
        description: Broadcaster ID (up to 100, repeatable).
        required: true
  # ── Clips, videos, schedule ──────────────────────────────────────
  - name: clips
    via: paginate
    path: /helix/clips
    accept: json
    requiresAnyOf: [broadcaster_id, game_id, id]
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
    params:
      broadcaster_id:
        description: Clips captured from this broadcaster's streams.
      game_id:
        description: Clips captured from streams playing this game.
      id:
        description: Specific clip IDs (up to 100, repeatable).
      started_at:
        description: Window start (RFC 3339). Default window is one week.
      ended_at:
        description: Window end (RFC 3339).
      is_featured:
        description: Filter to featured (true) or non-featured (false) clips.
      first:
        description: Maximum number of clips per page (1–100, default 20).
      after:
        description: Cursor for forward pagination.
    dateParams:
      started_at: iso8601
      ended_at: iso8601
  - name: videos
    via: paginate
    path: /helix/videos
    accept: json
    requiresAnyOf: [id, user_id, game_id]
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
    params:
      id:
        description: Specific video IDs (up to 100, repeatable).
      user_id:
        description: Videos owned by this user.
      game_id:
        description: Videos of this game/category (capped at 500 results server-side).
      language:
        description: ISO 639-1 language code (only with game_id).
      period:
        description: 'Publication window: all (default) | day | week | month.'
      sort:
        description: 'Sort order: time (default) | trending | views.'
      type:
        description: 'Video type: all (default) | archive | highlight | upload.'
      first:
        description: Maximum number of items per page (1–100, default 20).
      after:
        description: Cursor for forward pagination.
  - name: schedule
    via: paginate
    path: /helix/schedule
    accept: json
    pagination:
      style: cursor
      itemsPath: data.segments
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
    params:
      broadcaster_id:
        description: Broadcaster whose schedule to read.
        required: true
      id:
        description: Specific segment IDs (up to 100, repeatable).
      start_time:
        description: Return segments starting at/after this UTC time (RFC 3339).
      first:
        description: Maximum number of segments per page (1–25, default 20).
      after:
        description: Cursor for forward pagination.
    dateParams:
      start_time: iso8601
  # ── Teams ────────────────────────────────────────────────────────
  - name: teams
    via: restGet
    path: /helix/teams
    accept: json
    requiresAnyOf: [name, id]
    params:
      name:
        description: Team name (mutually exclusive with id).
      id:
        description: Team ID (mutually exclusive with name).
  - name: channelTeams
    via: restGet
    path: /helix/teams/channel
    accept: json
    params:
      broadcaster_id:
        description: Broadcaster whose team memberships to list.
        required: true
  # ── Chat surface (app-token readable) ────────────────────────────
  - name: cheermotes
    via: restGet
    path: /helix/bits/cheermotes
    accept: json
    params:
      broadcaster_id:
        description: Include this broadcaster's custom Cheermotes (omit for global only).
  - name: chatEmotesGlobal
    via: restGet
    path: /helix/chat/emotes/global
    accept: json
    params: {}
  - name: chatEmotes
    via: restGet
    path: /helix/chat/emotes
    accept: json
    params:
      broadcaster_id:
        description: Broadcaster whose channel emotes to get.
        required: true
  - name: chatEmoteSets
    via: restGet
    path: /helix/chat/emotes/set
    accept: json
    params:
      emote_set_id:
        description: Emote set ID (up to 25, repeatable). The global set is "0".
        required: true
  - name: chatBadgesGlobal
    via: restGet
    path: /helix/chat/badges/global
    accept: json
    params: {}
  - name: chatBadges
    via: restGet
    path: /helix/chat/badges
    accept: json
    params:
      broadcaster_id:
        description: Broadcaster whose chat badges to get.
        required: true
  # ── Misc reference data ──────────────────────────────────────────
  - name: contentClassificationLabels
    via: restGet
    path: /helix/content_classification_labels
    accept: json
    params:
      locale:
        description: 'Label locale (default "en-US"; e.g. de-DE, ja-JP).'
  # Lists this app's own EventSub subscriptions (filters are mutually exclusive).
  - name: eventSubSubscriptions
    via: paginate
    path: /helix/eventsub/subscriptions
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      pageSize: 20
      totalCountPath: total
    params:
      status:
        description: Filter by status (e.g. enabled, webhook_callback_verification_pending).
      type:
        description: Filter by subscription type (e.g. stream.online).
      user_id:
        description: Filter by user ID in the subscription condition.
      subscription_id:
        description: Filter by subscription ID.
      conduit_id:
        description: Filter by conduit ID.
      first:
        description: Maximum number of items per page (default 20).
      after:
        description: Cursor for forward pagination.
---

# Notes

- App access tokens are not refreshable (Twitch docs: "You cannot refresh app
  access tokens") — the resolver re-mints on expiry instead of refreshing.
- Helix requires the `Client-Id` header on every request in addition to the
  Bearer token; both resolve from the same `client_id` store secret.
- Coverage: every Helix GET readable with an **app access token** and no user
  scope — streams/categories/games, search, clips, videos, channel schedule,
  users, channel info, teams, chat emotes/badges (global + per-channel),
  cheermotes, content classification labels, and this app's EventSub
  subscriptions.
- Mutually exclusive selectors are declared with `requiresAnyOf`
  (`games`, `clips`, `videos`, `teams`, `users`); `schedule` 404s for
  broadcasters who have no broadcast schedule — that is the API's "empty"
  signal, not an auth failure.
- Excluded (require a *user* access token with scopes, not obtainable via
  client_credentials): followed streams/channels, followers, markers,
  moderation/*, polls, predictions, goals, hype trains, charity, chat
  settings/chatters, subscriptions, analytics, bits leaderboard, ads.
- Excluded (dead or gated): `GET /helix/streams/tags` + `GET /helix/tags/streams`
  are deprecated (HTTP 410); `GET /helix/clips/downloads` needs editor
  authorization; `GET /helix/entitlements/drops` returns entitlements only for
  games owned by the app's organization; `GET /helix/extensions/*` needs
  extension JWTs.
