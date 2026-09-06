---
kind: api
schemaVersion: 1
description: Twitch Helix reads that need a user access token (own-channel and followed-data reads).
domains:
  - twitch.tv
shortName: Twitch User
icon: 🎮
apiHost: https://api.twitch.tv
auth:
  # authorization_code: Helix reads with user context (followed streams,
  # own followers, chat, goals, hype train, subscriptions). The user token
  # lives in its own slot — (twitch.tv, authorization_code, tokenUrl) — so it
  # coexists with the app-token slot the `twitch` guide uses (Phase 2.9
  # multi-grant slots, one <domain>.json file).
  # User access tokens expire (~4 h); the resolver lazily refreshes with the
  # stored refresh token (Twitch returns the same refresh token — no
  # rotation). Refresh requires client_id + client_secret from the store.
  kind: oauth2
  grant: authorization_code
  tokenUrl: https://id.twitch.tv/oauth2/token
  authorizeUrl: https://id.twitch.tv/oauth2/authorize
  revokeUrl: https://id.twitch.tv/oauth2/revoke
  clientId:
    secret: client_id
  clientSecret:
    secret: client_secret
  tokenEndpointAuthMethod: client_secret_post
  scopes:
    - "channel:read:goals"
    - "channel:read:hype_train"
    - "channel:read:redemptions"
    - "channel:read:subscriptions"
    - "moderator:read:chatters"
    - "moderator:read:followers"
    - "user:read:broadcast"
    - "user:read:email"
    - "user:read:follows"
  secretRefs:
    Client-Id:
      secret: client_id
responseShape:
  format: json
  charset: utf-8
verified: "2026-08-30"
docs: https://dev.twitch.tv/docs/api/reference/
operations:
  # The token's own user (no params → the user in the access token).
  # Includes the verified email (user:read:email is minted for this guide).
  - name: me
    via: restGet
    path: /helix/users
    accept: json
    params: {}
  # ── Follows ──────────────────────────────────────────────────────
  - name: followedStreams
    via: paginate
    path: /helix/streams/followed
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
    params:
      user_id:
        description: User whose followed live streams to list (must match the access token's user).
        required: true
      first:
        description: Maximum number of items per page (1–100, default 100).
      after:
        description: Cursor for forward pagination.
  - name: channelFollowers
    via: paginate
    path: /helix/channels/followers
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      totalCountPath: total
    params:
      broadcaster_id:
        description: Broadcaster whose followers to list. Must match the token's user, or the token's user must moderate that channel — otherwise only `total` is returned.
        required: true
      user_id:
        description: Check whether this specific user follows the broadcaster.
      first:
        description: Maximum number of items per page (1–100, default 20).
      after:
        description: Cursor for forward pagination.
  # ── Broadcast (own channel) ──────────────────────────────────────
  - name: streamMarkers
    via: paginate
    path: /helix/streams/markers
    accept: json
    requiresAnyOf: [user_id, video_id]
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
    params:
      user_id:
        description: Markers from this user's most recent VOD (mutually exclusive with video_id; must match the token's user or be an editor).
      video_id:
        description: Markers from this specific VOD (mutually exclusive with user_id; must be owned by the token's user or an editor).
      first:
        description: Maximum number of items per page (1–100, default 20).
      before:
        description: Cursor for backward pagination.
      after:
        description: Cursor for forward pagination.
  - name: goals
    via: restGet
    path: /helix/goals
    accept: json
    params:
      broadcaster_id:
        description: Broadcaster whose goals to read (must match the access token's user).
        required: true
  - name: hypeTrain
    via: restGet
    path: /helix/hypetrain/status
    accept: json
    params:
      broadcaster_id:
        description: Broadcaster whose hype-train status to read (must match the access token's user).
        required: true
  - name: chatters
    via: paginate
    path: /helix/chat/chatters
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      totalCountPath: total
    params:
      broadcaster_id:
        description: Broadcaster whose chat session to read.
        required: true
      moderator_id:
        description: The broadcaster or one of their moderators (must match the access token's user).
        required: true
      first:
        description: Maximum number of items per page (1–1000, default 100).
      after:
        description: Cursor for forward pagination.
  # ── Subscriptions ────────────────────────────────────────────────
  - name: subscriptions
    via: paginate
    path: /helix/subscriptions
    accept: json
    pagination:
      style: cursor
      itemsPath: data
      cursorPath: pagination.cursor
      cursorParam: after
      pageSizeParam: first
      totalCountPath: total
    params:
      broadcaster_id:
        description: Broadcaster whose subscribers to list (must match the access token's user).
        required: true
      user_id:
        description: Filter to specific subscriber IDs (up to 100; an array serializes as repeated `user_id=` pairs).
        listStyle: repeat
      first:
        description: Maximum number of items per page (1–100, default 20).
      after:
        description: Cursor for forward pagination.
---

# Notes

- Sibling of the `twitch` guide (same domain claim, same Helix API): that one
  covers every **app access token** read; this one covers the **user access
  token** reads listed above. Op names are disjoint across the two guides —
  `api-fetch` resolves ops by name across all guides claiming `twitch.tv`,
  and a duplicate name would be an ambiguous-collision error.
- Token provisioning: `/api oauth twitch.tv` (authorization_code paste flow).
  Both store secrets (`client_id`, `client_secret`) are shared with the app
  guide. The two tokens live in **separate slots** of the same
  `~/.pi/agent/pi-lean-host/oauth/twitch.tv.json` file, keyed
  `(domain, grant, tokenUrl)` — minting one never clobbers the other.
- Token lifecycle: user access tokens expire (~4 h); the resolver lazily
  refreshes with the stored refresh token (Twitch does **not** rotate refresh
  tokens — the same one is returned each refresh). Twitch accepts the
  `refresh_token` grant with `client_id` + `client_secret` in the form body
  (`tokenEndpointAuthMethod: client_secret_post`).
- Loopback redirect caveat (minting only): Twitch accepts only `https://` or
  the literal `localhost` spelling for loopback redirects — the RFC 8252
  `http://127.0.0.1/callback` default is refused at the authorize step. Pass
  the URI registered in the app's dev console via `--redirect-uri` (it is
  stored in the pending flow, so the `--code` completion needs no re-supply).
- Live-test shape: every endpoint here reads only data the token's user may
  see, so the coverage tests run against the token's own `user_id` /
  `broadcaster_id`. Several endpoints return the API's "empty" signal as a
  **404** (not a 200-empty body) when the data doesn't exist — `streamMarkers`
  with no recent VOD, `hypeTrain` with no hype train (the docs document no
  empty-data case for it). The tests treat those documented 404s as the
  empty signal, exactly like the app guide treats `schedule` 404s.
- Excluded (scope not provisioned in the minted token — a future re-consent
  with wider scopes is the upgrade path): `polls` (channel:read:polls),
  `predictions` (channel:read:predictions), `moderation/moderators`
  (moderation:read — note the legacy singular scope name), chat settings,
  automod, blocked terms, banned users, VIPs, shared chat, pinned messages,
  user chat color, user blocks, user emotes, subscription check
  (user:read:subscriptions), bits leaderboard, game/extension analytics, ad
  schedule, charity, whispers, drops entitlements (org-owned games only).
- Excluded (partner/affiliate-gated — this account is neither):
  `GET /helix/channel_points/custom_rewards` (403 "must have partner or
  affiliate status") and its `.../redemptions` sub-endpoint (also requires an
  unsatisfiable `reward_id` and only the app that created the reward may read
  it). The `channel:read:redemptions` scope is retained in the minted set for
  when the account matures into affiliate status.
- Excluded (dead or misdirected): `GET /helix/users/follows` is deprecated
  (replaced by `followedStreams` + `channelFollowers`); `GET /helix/videos/markers`
  does not exist in the current reference — markers ride the `user_id` /
  `video_id` selectors of `GET /helix/streams/markers` (probe-verified 404);
  `GET /helix/clips/downloads` needs editor authorization;
  `GET /helix/extensions/*` needs extension JWTs.
