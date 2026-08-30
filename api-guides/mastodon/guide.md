---
kind: api
schemaVersion: 1
description: Mastodon (mastodon.social) read-only API — timelines, accounts, statuses, notifications (v1 + grouped), filters, lists, tags, search, trends, instance metadata, annual reports.
domains:
  - mastodon.social
shortName: Mastodon
icon: 🐘
apiHost: https://mastodon.social
auth:
  # authorization_code + PKCE: user-token reads (timelines, accounts, …).
  # App tokens are rejected by most read endpoints on Mastodon — user
  # consent in the browser is required. Guide defaults to mastodon.social;
  # other instances need their own guide (per-instance OAuth).
  kind: oauth2
  grant: authorization_code
  tokenUrl: https://mastodon.social/oauth/token
  authorizeUrl: https://mastodon.social/oauth/authorize
  clientId:
    secret: client_key
  clientSecret:
    secret: client_secret
  scopes:
    - read
    - profile
  tokenEndpointAuthMethod: client_secret_post
responseShape:
  format: json
  charset: utf-8
verified: "2026-08-30"
docs: https://docs.joinmastodon.org/api/
operations:
  # ── Own account ──────────────────────────────────────────────────
  - name: verifyCredentials
    via: restGet
    path: /api/v1/accounts/verify_credentials
    accept: json
    params: {}
  # The v4.4 Profile entity — richer than the Account verify_credentials
  # returns (role, status counters, bio source).
  - name: myProfile
    via: restGet
    path: /api/v1/profile
    accept: json
    params: {}
  - name: preferences
    via: restGet
    path: /api/v1/preferences
    accept: json
    params: {}
  # Saved read positions for timelines. `timeline[]` takes one value per
  # call (home or notifications) — the repeatable form isn't expressible.
  - name: markers
    via: restGet
    path: /api/v1/markers
    accept: json
    params:
      "timeline[]":
        description: Which timeline position(s) to read — `home` or `notifications` (one per call).
        required: true
  - name: favourites
    via: restGet
    path: /api/v1/favourites
    accept: json
    params:
      limit:
        description: Maximum results (default 40, max 80).
      max_id:
        description: Only statuses with ID less than this.
      since_id:
        description: Only statuses with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: bookmarks
    via: restGet
    path: /api/v1/bookmarks
    accept: json
    params:
      limit:
        description: Maximum number of results (default 20).
      max_id:
        description: Only statuses with ID less than this.
      since_id:
        description: Only statuses with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: mutes
    via: restGet
    path: /api/v1/mutes
    accept: json
    params:
      limit:
        description: Maximum number of results (default 40, max 80).
      max_id:
        description: Only accounts with ID less than this.
      since_id:
        description: Only accounts with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: blocks
    via: restGet
    path: /api/v1/blocks
    accept: json
    params:
      limit:
        description: Maximum number of results (default 40, max 80).
      max_id:
        description: Only accounts with ID less than this.
      since_id:
        description: Only accounts with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: domainBlocks
    via: restGet
    path: /api/v1/domain_blocks
    accept: json
    params:
      limit:
        description: Maximum number of results (default 100, max 200).
      max_id:
        description: Only domains with ID less than this.
      since_id:
        description: Only domains with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: followRequests
    via: restGet
    path: /api/v1/follow_requests
    accept: json
    params:
      limit:
        description: Maximum number of results (default 40, max 80).
      max_id:
        description: Only accounts with ID less than this.
      since_id:
        description: Only accounts with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: conversations
    via: restGet
    path: /api/v1/conversations
    accept: json
    params:
      limit:
        description: Maximum number of results (default 20, max 40).
      max_id:
        description: Only conversations with ID less than this.
      since_id:
        description: Only conversations with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  # ── Lists ────────────────────────────────────────────────────────
  - name: lists
    via: restGet
    path: /api/v1/lists
    accept: json
    params: {}
  - name: list
    via: restGet
    path: /api/v1/lists/{id}
    accept: json
    params:
      id:
        description: The list ID.
  - name: listAccounts
    via: restGet
    path: /api/v1/lists/{id}/accounts
    accept: json
    params:
      id:
        description: The list ID.
      limit:
        description: Maximum number of accounts (default 40, max 80).
  # ── Filters (v2, server-side) ────────────────────────────────────
  - name: filters
    via: restGet
    path: /api/v2/filters
    accept: json
    params: {}
  - name: filter
    via: restGet
    path: /api/v2/filters/{id}
    accept: json
    params:
      id:
        description: The filter ID.
  - name: filterKeywords
    via: restGet
    path: /api/v2/filters/{filter_id}/keywords
    accept: json
    params:
      filter_id:
        description: The filter ID whose keywords to list.
  - name: filterKeyword
    via: restGet
    path: /api/v2/filters/keywords/{id}
    accept: json
    params:
      id:
        description: The filter keyword ID.
  - name: filterStatuses
    via: restGet
    path: /api/v2/filters/{filter_id}/statuses
    accept: json
    params:
      filter_id:
        description: The filter ID whose status-filtered IDs to list.
  - name: filterStatus
    via: restGet
    path: /api/v2/filters/statuses/{id}
    accept: json
    params:
      id:
        description: The filter-status ID.
  # ── Notifications (v1 + grouped v2) ──────────────────────────────
  - name: notifications
    via: restGet
    path: /api/v1/notifications
    accept: json
    params:
      limit:
        description: Maximum number of results (default 40, max 80).
      max_id:
        description: Only notifications older than this ID.
      since_id:
        description: Only notifications newer than this ID.
      min_id:
        description: Returns results immediately newer than this ID.
      account_id:
        description: Return only notifications received from this account.
      include_filtered:
        description: Whether to include notifications filtered by the NotificationPolicy (default false).
      "types[]":
        description: Only these notification types (one per call).
      "exclude_types[]":
        description: Exclude these notification types (one per call).
  - name: notification
    via: restGet
    path: /api/v1/notifications/{id}
    accept: json
    params:
      id:
        description: The notification ID.
  - name: unreadNotificationCount
    via: restGet
    path: /api/v1/notifications/unread_count
    accept: json
    params:
      limit:
        description: Count at most this many (default 100, max 1000).
      account_id:
        description: Only count unread notifications received from this account.
      "types[]":
        description: Only count these notification types (one per call).
      "exclude_types[]":
        description: Exclude these notification types (one per call).
  - name: notificationPolicy
    via: restGet
    path: /api/v2/notifications/policy
    accept: json
    params: {}
  - name: notificationRequests
    via: restGet
    path: /api/v1/notifications/requests
    accept: json
    params:
      limit:
        description: Maximum number of results (default 40, max 80).
      max_id:
        description: Only notification requests older than this ID.
      since_id:
        description: Only notification requests newer than this ID.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: notificationRequest
    via: restGet
    path: /api/v1/notifications/requests/{id}
    accept: json
    params:
      id:
        description: The notification request ID.
  - name: notificationRequestsMerged
    via: restGet
    path: /api/v1/notifications/requests/merged
    accept: json
    params: {}
  # Grouped notifications (v4.3+) — the notification feed as NotificationGroups.
  - name: groupedNotifications
    via: restGet
    path: /api/v2/notifications
    accept: json
    params:
      limit:
        description: Maximum number of results (default 40, max 80 notification groups).
      max_id:
        description: Only notifications strictly older than this ID.
      since_id:
        description: Only notifications strictly newer than this ID.
      min_id:
        description: Returns results immediately newer than this ID.
      account_id:
        description: Return only notifications received from this account.
      expand_accounts:
        description: "`full` (default) or `partial_avatars` — whether grouped accounts render in full or in the stripped-down `partial_accounts` list."
      include_filtered:
        description: Whether to include filtered notifications (default false).
      "grouped_types[]":
        description: Which notification types may be grouped (one per call).
      "types[]":
        description: Only these notification types (one per call).
      "exclude_types[]":
        description: Exclude these notification types (one per call).
  - name: notificationGroup
    via: restGet
    path: /api/v2/notifications/{group_key}
    accept: json
    params:
      group_key:
        description: The group key (from groupedNotifications results).
  - name: notificationGroupAccounts
    via: restGet
    path: /api/v2/notifications/{group_key}/accounts
    accept: json
    params:
      group_key:
        description: The group key whose notification accounts to list.
  - name: groupedUnreadCount
    via: restGet
    path: /api/v2/notifications/unread_count
    accept: json
    params:
      limit:
        description: Count at most this many (default 100, max 1000).
      account_id:
        description: Only count unread notifications received from this account.
      "grouped_types[]":
        description: Which notification types may be grouped (one per call).
  # ── Timelines ────────────────────────────────────────────────────
  - name: homeTimeline
    via: restGet
    path: /api/v1/timelines/home
    accept: json
    params:
      limit:
        description: Maximum number of statuses (default 20, max 40).
      max_id:
        description: Only statuses with ID less than this.
      since_id:
        description: Only statuses with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: publicTimeline
    via: restGet
    path: /api/v1/timelines/public
    accept: json
    params:
      local:
        description: Show only local statuses (default false).
      remote:
        description: Show only remote statuses (default false).
      only_media:
        description: Show only statuses with media attached (default false).
      limit:
        description: Maximum number of statuses (default 20, max 40).
      offset:
        description: Skip the first n results.
      max_id:
        description: Only statuses with ID less than this.
      since_id:
        description: Only statuses with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: tagTimeline
    via: restGet
    path: /api/v1/timelines/tag/{hashtag}
    accept: json
    params:
      hashtag:
        description: The hashtag to read (without the #).
      local:
        description: Show only local statuses (default false).
      only_media:
        description: Show only statuses with media attached (default false).
      limit:
        description: Maximum number of statuses (default 20, max 40).
      offset:
        description: Skip the first n results.
      max_id:
        description: Only statuses with ID less than this.
      since_id:
        description: Only statuses with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  # Posts that link to the given URL (trending-link context, v4.3+).
  - name: linkTimeline
    via: restGet
    path: /api/v1/timelines/link
    accept: json
    params:
      url:
        description: The URL whose linked-posts timeline to read (must be a known trending link).
        required: true
  - name: listTimeline
    via: restGet
    path: /api/v1/timelines/list/{list_id}
    accept: json
    params:
      list_id:
        description: The list ID whose timeline to read.
      limit:
        description: Maximum number of statuses (default 20, max 40).
  # ── Accounts ─────────────────────────────────────────────────────
  - name: account
    via: restGet
    path: /api/v1/accounts/{id}
    accept: json
    params:
      id:
        description: The account ID.
  # Multiple accounts by ID — repeatable `id[]` form; one value per call here.
  - name: accounts
    via: restGet
    path: /api/v1/accounts
    accept: json
    params:
      "id[]":
        description: Account ID (one per call; the repeatable `id[]` form isn't expressible).
        required: true
  - name: accountStatuses
    via: restGet
    path: /api/v1/accounts/{id}/statuses
    accept: json
    params:
      id:
        description: The account ID.
      limit:
        description: Maximum number of statuses (default 20, max 40).
      only_media:
        description: Only statuses with attachments.
      exclude_replies:
        description: Filter out replies to other accounts.
      exclude_reblogs:
        description: Filter out boosts.
      pinned:
        description: Only pinned statuses.
      tagged:
        description: Filter for statuses using a specific hashtag.
      max_id:
        description: Only statuses with ID less than this.
      since_id:
        description: Only statuses with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: accountFollowers
    via: restGet
    path: /api/v1/accounts/{id}/followers
    accept: json
    params:
      id:
        description: The account ID.
      limit:
        description: Maximum number of results (default 40, max 80).
      max_id:
        description: Only accounts with ID less than this.
      since_id:
        description: Only accounts with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: accountFollowing
    via: restGet
    path: /api/v1/accounts/{id}/following
    accept: json
    params:
      id:
        description: The account ID.
      limit:
        description: Maximum number of results (default 40, max 80).
      max_id:
        description: Only accounts with ID less than this.
      since_id:
        description: Only accounts with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: accountFeaturedTags
    via: restGet
    path: /api/v1/accounts/{id}/featured_tags
    accept: json
    params:
      id:
        description: The account ID.
  - name: accountLists
    via: restGet
    path: /api/v1/accounts/{id}/lists
    accept: json
    params:
      id:
        description: The account ID.
  - name: accountEndorsements
    via: restGet
    path: /api/v1/accounts/{id}/endorsements
    accept: json
    params:
      id:
        description: The account ID.
  # Collections (v4.4+) — curated account lists. Read via read:collections
  # (covered by the umbrella `read` scope).
  - name: accountCollections
    via: restGet
    path: /api/v1/accounts/{account_id}/collections
    accept: json
    params:
      account_id:
        description: The account whose Collections to list.
  - name: inCollections
    via: restGet
    path: /api/v1/accounts/{account_id}/in_collections
    accept: json
    params:
      account_id:
        description: The account to find Collections featuring.
  - name: collection
    via: restGet
    path: /api/v1/collections/{id}
    accept: json
    params:
      id:
        description: The Collection ID.
  - name: accountRelationships
    via: restGet
    path: /api/v1/accounts/relationships
    accept: json
    params:
      "id[]":
        description: Account ID to check the relationship with (one per call; the API's repeatable `id[]` form isn't expressible here).
        required: true
      with_suspended:
        description: Whether to include suspended users (default false).
  - name: familiarFollowers
    via: restGet
    path: /api/v1/accounts/familiar_followers
    accept: json
    params:
      "id[]":
        description: Account ID to find familiar followers for (one per call).
        required: true
  - name: lookupAccount
    via: restGet
    path: /api/v1/accounts/lookup
    accept: json
    params:
      acct:
        description: The username or WebFinger address (user@domain) to lookup.
        required: true
  - name: searchAccounts
    via: restGet
    path: /api/v1/accounts/search
    accept: json
    params:
      q:
        description: Search query for accounts.
        required: true
      limit:
        description: Maximum number of results (default 40, max 80).
      offset:
        description: Skip the first n results.
      resolve:
        description: Attempt WebFinger lookup (use when q is an exact address).
      following:
        description: Limit to accounts you follow (default false).
  # ── Statuses ─────────────────────────────────────────────────────
  - name: status
    via: restGet
    path: /api/v1/statuses/{id}
    accept: json
    params:
      id:
        description: The status ID.
  - name: statuses
    via: restGet
    path: /api/v1/statuses
    accept: json
    params:
      "id[]":
        description: Status ID (one per call; the repeatable `id[]` form isn't expressible here).
        required: true
  - name: statusContext
    via: restGet
    path: /api/v1/statuses/{id}/context
    accept: json
    params:
      id:
        description: The status ID.
  # Raw text/source of a status as its author sees it (text, spoiler_text).
  - name: statusSource
    via: restGet
    path: /api/v1/statuses/{id}/source
    accept: json
    params:
      id:
        description: The status ID.
  - name: statusHistory
    via: restGet
    path: /api/v1/statuses/{id}/history
    accept: json
    params:
      id:
        description: The status ID.
  - name: statusRebloggedBy
    via: restGet
    path: /api/v1/statuses/{id}/reblogged_by
    accept: json
    params:
      id:
        description: The status ID.
  - name: statusFavouritedBy
    via: restGet
    path: /api/v1/statuses/{id}/favourited_by
    accept: json
    params:
      id:
        description: The status ID.
  - name: statusQuotes
    via: restGet
    path: /api/v1/statuses/{id}/quotes
    accept: json
    params:
      id:
        description: The quoted status ID.
  - name: poll
    via: restGet
    path: /api/v1/polls/{id}
    accept: json
    params:
      id:
        description: The poll ID (from a status's `poll` attribute).
  # ── Tags ─────────────────────────────────────────────────────
  - name: followedTags
    via: restGet
    path: /api/v1/followed_tags
    accept: json
    params:
      limit:
        description: Maximum number of results (default 100, max 200).
      max_id:
        description: Only tags with ID less than this.
      since_id:
        description: Only tags with ID greater than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: featuredTags
    via: restGet
    path: /api/v1/featured_tags
    accept: json
    params: {}
  - name: featuredTagSuggestions
    via: restGet
    path: /api/v1/featured_tags/suggestions
    accept: json
    params: {}
  - name: tag
    via: restGet
    path: /api/v1/tags/{id}
    accept: json
    params:
      id:
        description: The hashtag name (without the #).
  # ── Search, suggestions, directory ───────────────────────────────
  - name: search
    via: restGet
    path: /api/v2/search
    accept: json
    params:
      q:
        description: The search query.
        required: true
      type:
        description: Restrict to `accounts`, `hashtags`, or `statuses`.
      resolve:
        description: Attempt WebFinger lookup (only with accounts type or HTTPS-URL queries).
      following:
        description: Only include accounts you follow (default false).
      account_id:
        description: Only return statuses authored by this account.
      limit:
        description: Maximum results per type (default 20, max 40).
      offset:
        description: Skip the first n results.
      max_id:
        description: Only results with ID less than this.
      min_id:
        description: Returns results immediately newer than this ID.
  - name: suggestions
    via: restGet
    path: /api/v2/suggestions
    accept: json
    params:
      limit:
        description: Maximum number of suggestions (default 40, max 80).
  - name: directory
    via: restGet
    path: /api/v1/directory
    accept: json
    params:
      limit:
        description: How many accounts to load (default 40, max 80).
      offset:
        description: Skip the first n accounts.
      local:
        description: Only local accounts (default false).
      order:
        description: Sort order — `active` (default) or `new`.
  - name: announcements
    via: restGet
    path: /api/v1/announcements
    accept: json
    params:
      with_dismissed:
        description: Include announcements already dismissed (default false).
  # ── Instance metadata (public; token rides along harmlessly) ─────
  - name: instanceV2
    via: restGet
    path: /api/v2/instance
    accept: json
    params: {}
  - name: instance
    via: restGet
    path: /api/v1/instance
    accept: json
    params: {}
  - name: instancePeers
    via: restGet
    path: /api/v1/instance/peers
    accept: json
    params: {}
  - name: instanceActivity
    via: restGet
    path: /api/v1/instance/activity
    accept: json
    params: {}
  - name: instanceRules
    via: restGet
    path: /api/v1/instance/rules
    accept: json
    params: {}
  - name: instanceDomainBlocks
    via: restGet
    path: /api/v1/instance/domain_blocks
    accept: json
    params: {}
  - name: instanceExtendedDescription
    via: restGet
    path: /api/v1/instance/extended_description
    accept: json
    params: {}
  - name: instancePrivacyPolicy
    via: restGet
    path: /api/v1/instance/privacy_policy
    accept: json
    params: {}
  - name: instanceTermsOfService
    via: restGet
    path: /api/v1/instance/terms_of_service
    accept: json
    params: {}
  - name: instanceTranslationLanguages
    via: restGet
    path: /api/v1/instance/translation_languages
    accept: json
    params: {}
  - name: oembed
    via: restGet
    path: /api/oembed
    accept: json
    params:
      url:
        description: The status URL to fetch embed info for.
        required: true
  - name: customEmojis
    via: restGet
    path: /api/v1/custom_emojis
    accept: json
    params: {}
  - name: health
    via: restGet
    path: /health
    accept: json
    params: {}
    parse:
      format: text
  # ── Trends ───────────────────────────────────────────────────────
  - name: trendsTags
    via: restGet
    path: /api/v1/trends/tags
    accept: json
    params:
      limit:
        description: Maximum number of results (default 10, max 20).
      offset:
        description: Skip the first n results.
  - name: trendsStatuses
    via: restGet
    path: /api/v1/trends/statuses
    accept: json
    params:
      limit:
        description: Maximum number of results (default 20, max 40).
      offset:
        description: Skip the first n results.
  - name: trendsLinks
    via: restGet
    path: /api/v1/trends/links
    accept: json
    params:
      limit:
        description: Maximum number of results (default 10, max 20).
      offset:
        description: Skip the first n results.
  # ── Annual reports (Wrapstodon) ──────────────────────────────────
  - name: annualReports
    via: restGet
    path: /api/v1/annual_reports
    accept: json
    params: {}
  - name: annualReport
    via: restGet
    path: /api/v1/annual_reports/{year}
    accept: json
    params:
      year:
        description: The report year (from annualReports).
  - name: annualReportState
    via: restGet
    path: /api/v1/annual_reports/{year}/state
    accept: json
    params:
      year:
        description: The report year.
---

# Notes

- **Read-only user-token guide.** The minted token carries the umbrella
  `read` scope (which expands to every `read:*` scope) plus `profile`, so
  every GET endpoint of the API is reachable with it. Provisioning:
  `/api oauth mastodon.social` (authorization_code paste flow); secrets
  `client_key` / `client_secret` live at `/api secrets mastodon.social`.
  Mastodon access tokens carry no refresh token — when the token expires,
  re-mint via the paste flow (the endpoint answers `401` with
  `"The access token is invalid"`).
- **`restGet` only — Link-header pagination is a schema gap.** Mastodon
  returns its next-page cursor in the RFC 5988 `Link` header (`max_id` /
  `min_id` embedded in the URL), not in a JSON body field — exactly the
  header-based style the v1 `pagination.style` set has no support for (same
  evidence as the `github` guide's ⚠ note). Every op here is therefore
  `restGet` with the first page; callers walk pages by passing the `max_id`
  (or `min_id`) of the last-seen item. No `paginate` op is possible without
  a header-aware pagination style in the framework.
- **Repeatable array params serialize one value per call.** Endpoints
  documented as taking `id[]` (relationships, familiar followers,
  multi-status fetch) or `timeline[]` accept a single value per call here —
  the query builder serializes scalar values only. Multi-ID fan-out is a
  caller-side loop.
- **Public endpoints carry the token too.** Instance metadata, trends,
  custom emojis, directory, lookup, and public statuses accept the Bearer
  without complaint (and the same op works unauthenticated on any client).
  Privacy-scoped reads (home timeline, favourites, filters, notifications)
  hard-fail with `401 The access token is invalid` without it.
- **Live-test pinning.** The coverage tests look up the pinned
  `@Mastodon@mastodon.social` account to derive a stable status id for the
  status-detail reads, and skip list/filter/notification-group sub-resource
  tests when the account holds no lists/filters/grouped notifications —
  those endpoints have no null-args "empty" shape (a bad id is a hard 404),
  unlike Twitch's documented empty-signal 404s.
- **mastodon.social server quirks (probe-verified 2026-08-30).** The
  federated timeline (`publicTimeline`) is **disabled server-side** — the
  endpoint is authorized but structurally returns `[]` (with the token or
  without it, the latter as 401). `GET /api/v1/accounts/:id/in_collections`
  (`inCollections`) answers `403 "This action is not allowed"` — Collections
  are feature-flagged off server-side, though the sibling `accountCollections`
  read works and returns an empty envelope. Both ops are kept (documented
  API surface); the live suite skips `inCollections` and treats the empty
  public timeline as the server's documented empty shape.
- Excluded (scope-unreachable): `GET /api/v1/media/:id` requires
  `write:media` — it's the upload-processing poll, not a read of an
  attachment (attachments arrive embedded in Status entities).
- Excluded (not read-only): everything on `POST`/`PATCH`/`DELETE` (posting,
  follows/blocks/mutes writes, list/filter/notification-policy mutations,
  markers POST, report/poll/media writes, push subscriptions). The
  transport is GET-only by contract.
- Excluded (unreachable or dead): `GET /api/v1/timelines/direct`
  (removed in 3.0), `GET /api/v1/statuses/:id/card` (removed — preview
  cards are embedded in Status entities since 4.0), `GET /api/proofs`
  (removed — keybase proofs are dead), `GET /api/v1/search` v1
  (removed), `GET /api/v1/suggestions` v1 (deprecated → v2), the
  `/api/v1/notifications/dismiss` POST-form arm (write-only), the
  alpha/experimental `notifications_alpha` + `async_refreshes` groups,
  admin/* (admin scopes), `GET /api/v1/push/subscription` (push scope —
  not granted), and `GET /api/v1/timelines/…/direct`. The dated
  terms-of-service variant (`/api/v1/instance/terms_of_service/:date`)
  is omitted — the current one (`instanceTermsOfService`) covers reads.
