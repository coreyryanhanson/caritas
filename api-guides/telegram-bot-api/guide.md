---
kind: api
schemaVersion: 1
domains:
  - telegram.org
shortName: Telegram Bot API
icon: 🤖
description: Telegram Bot API (read-only bot methods). Keyed via the bot token in the URL path.
apiHost: https://api.telegram.org
auth:
  kind: static-key
  secretPathRefs:
    token:
      secret: bot_token
responseShape:
  format: json
  charset: utf-8
docs: https://core.telegram.org/bots/api
operations:
  # ── Getting updates ──────────────────────────────────────────────
  - name: getUpdates
    via: restGet
    path: /bot{token}/getUpdates
    accept: json
    params:
      offset:
        description: Identifier of the first update to be returned. Must be greater by one than the highest previously received update_id; a negative offset retrieves from the end of the queue and confirms those updates. Defaults to the earliest unconfirmed update.
      limit:
        description: Number of updates to retrieve, 1-100. Defaults to 100.
      timeout:
        description: Long-polling timeout in seconds. Defaults to 0 (usual short polling) — keep 0 for automated use; positive values hold the connection open.
      allowed_updates:
        description: A JSON-serialized list of update types to receive, e.g. '["message","callback_query"]'. Empty list receives all except chat_member, message_reaction, message_reaction_count. Not specified → previous setting kept.

  - name: getWebhookInfo
    via: restGet
    path: /bot{token}/getWebhookInfo
    accept: json

  # ── Bot identity & user/chat info ────────────────────────────────
  - name: getMe
    via: restGet
    path: /bot{token}/getMe
    accept: json

  - name: getUserProfilePhotos
    via: restGet
    path: /bot{token}/getUserProfilePhotos
    accept: json
    params:
      user_id:
        description: Unique identifier of the target user.
        required: true
      offset:
        description: Sequential number of the first photo to be returned. By default, all photos are returned.
      limit:
        description: Number of photos to retrieve, 1-100. Defaults to 100.

  - name: getUserProfileAudios
    via: restGet
    path: /bot{token}/getUserProfileAudios
    accept: json
    params:
      user_id:
        description: Unique identifier of the target user.
        required: true
      offset:
        description: Sequential number of the first audio to be returned. By default, all audios are returned.
      limit:
        description: Number of audios to retrieve, 1-100. Defaults to 100.

  - name: getFile
    via: restGet
    path: /bot{token}/getFile
    accept: json
    params:
      file_id:
        description: File identifier to get information about (obtain from a message's photo/document/audio etc.). The File result carries file_path; the actual download is https://api.telegram.org/file/bot<token>/<file_path> (binary, out of scope here).
        required: true

  - name: getChat
    via: restGet
    path: /bot{token}/getChat
    accept: json
    params:
      chat_id:
        description: Unique identifier for the target chat or username of the target supergroup or channel in the format @channelusername.
        required: true

  - name: getChatAdministrators
    via: restGet
    path: /bot{token}/getChatAdministrators
    accept: json
    params:
      chat_id:
        description: Unique identifier for the target chat or username of the target supergroup or channel in the format @channelusername.
        required: true
      return_bots:
        description: Pass True to additionally receive all bots that are administrators of the chat. By default, bots other than the current bot are omitted.

  - name: getChatMemberCount
    via: restGet
    path: /bot{token}/getChatMemberCount
    accept: json
    params:
      chat_id:
        description: Unique identifier for the target chat or username of the target supergroup or channel in the format @channelusername.
        required: true

  - name: getChatMember
    via: restGet
    path: /bot{token}/getChatMember
    accept: json
    params:
      chat_id:
        description: Unique identifier for the target chat or username of the target supergroup or channel in the format @channelusername.
        required: true
      user_id:
        description: Unique identifier of the target user. Only guaranteed for other users if the bot is an administrator in the chat; the bot's own membership needs no rights.
        required: true

  - name: getUserPersonalChatMessages
    via: restGet
    path: /bot{token}/getUserPersonalChatMessages
    accept: json
    params:
      user_id:
        description: Unique identifier for the target user.
        required: true
      limit:
        description: Maximum number of messages to return, 1-20.
        required: true

  - name: getForumTopicIconStickers
    via: restGet
    path: /bot{token}/getForumTopicIconStickers
    accept: json

  - name: getUserChatBoosts
    via: restGet
    path: /bot{token}/getUserChatBoosts
    accept: json
    params:
      chat_id:
        description: Unique identifier for the target chat or username of the channel in the format @channelusername.
        required: true
      user_id:
        description: Unique identifier of the target user.
        required: true

  # ── Business / managed bots (entitlement-gated reads) ────────────
  - name: getBusinessConnection
    via: restGet
    path: /bot{token}/getBusinessConnection
    accept: json
    params:
      business_connection_id:
        description: Unique identifier of the business connection.
        required: true

  - name: getManagedBotAccessSettings
    via: restGet
    path: /bot{token}/getManagedBotAccessSettings
    accept: json
    params:
      user_id:
        description: User identifier of the managed bot whose access settings will be returned (a bot this bot manages).
        required: true

  # ── Bot profile reads ────────────────────────────────────────────
  - name: getMyCommands
    via: restGet
    path: /bot{token}/getMyCommands
    accept: json
    params:
      scope:
        description: A JSON-serialized BotCommandScope object, e.g. '{"type":"default"}'. Defaults to BotCommandScopeDefault.
      language_code:
        description: A two-letter ISO 639-1 language code or an empty string.

  - name: getMyName
    via: restGet
    path: /bot{token}/getMyName
    accept: json
    params:
      language_code:
        description: A two-letter ISO 639-1 language code or an empty string.

  - name: getMyDescription
    via: restGet
    path: /bot{token}/getMyDescription
    accept: json
    params:
      language_code:
        description: A two-letter ISO 639-1 language code or an empty string.

  - name: getMyShortDescription
    via: restGet
    path: /bot{token}/getMyShortDescription
    accept: json
    params:
      language_code:
        description: A two-letter ISO 639-1 language code or an empty string.

  - name: getChatMenuButton
    via: restGet
    path: /bot{token}/getChatMenuButton
    accept: json
    params:
      chat_id:
        description: Unique identifier for a private chat with another user; omit to get the default menu button.

  - name: getMyDefaultAdministratorRights
    via: restGet
    path: /bot{token}/getMyDefaultAdministratorRights
    accept: json
    params:
      for_channels:
        description: Pass True to get default administrator rights of the bot in channels; otherwise rights in groups are returned.

  # ── Gifts ────────────────────────────────────────────────────────
  - name: getAvailableGifts
    via: restGet
    path: /bot{token}/getAvailableGifts
    accept: json

  - name: getBusinessAccountStarBalance
    via: restGet
    path: /bot{token}/getBusinessAccountStarBalance
    accept: json
    params:
      business_connection_id:
        description: Unique identifier of the business connection. Requires the can_view_gifts_and_stars business bot right.
        required: true

  - name: getBusinessAccountGifts
    via: restGet
    path: /bot{token}/getBusinessAccountGifts
    accept: json
    params:
      business_connection_id:
        description: Unique identifier of the business connection. Requires the can_view_gifts_and_stars business bot right.
        required: true
      exclude_unsaved:
        description: Pass True to exclude gifts that aren't saved to the account's profile page.
      exclude_saved:
        description: Pass True to exclude gifts that are saved to the account's profile page.
      exclude_unlimited:
        description: Pass True to exclude gifts that can be purchased an unlimited number of times.
      exclude_limited_upgradable:
        description: Pass True to exclude gifts that can be purchased a limited number of times and can be upgraded to unique.
      exclude_limited_non_upgradable:
        description: Pass True to exclude gifts that can be purchased a limited number of times and can't be upgraded to unique.
      exclude_unique:
        description: Pass True to exclude unique gifts.
      exclude_from_blockchain:
        description: Pass True to exclude gifts that were assigned from the TON blockchain and can't be resold or transferred in Telegram.
      sort_by_price:
        description: Pass True to sort results by gift price instead of send date. Sorting is applied before pagination.
      offset:
        description: Offset of the first entry to return as received from the previous request; empty string for the first page.
      limit:
        description: The maximum number of gifts to be retrieved, 1-100. Defaults to 100.

  - name: getUserGifts
    via: restGet
    path: /bot{token}/getUserGifts
    accept: json
    params:
      user_id:
        description: Unique identifier of the user.
        required: true
      exclude_unlimited:
        description: Pass True to exclude gifts that can be purchased an unlimited number of times.
      exclude_limited_upgradable:
        description: Pass True to exclude gifts that can be purchased a limited number of times and can be upgraded to unique.
      exclude_limited_non_upgradable:
        description: Pass True to exclude gifts that can be purchased a limited number of times and can't be upgraded to unique.
      exclude_from_blockchain:
        description: Pass True to exclude gifts that were assigned from the TON blockchain and can't be resold or transferred in Telegram.
      exclude_unique:
        description: Pass True to exclude unique gifts.
      sort_by_price:
        description: Pass True to sort results by gift price instead of send date. Sorting is applied before pagination.
      offset:
        description: Offset of the first entry to return as received from the previous request; empty string for the first page.
      limit:
        description: The maximum number of gifts to be retrieved, 1-100. Defaults to 100.

  - name: getChatGifts
    via: restGet
    path: /bot{token}/getChatGifts
    accept: json
    params:
      chat_id:
        description: Unique identifier for the target chat or username of the target channel in the format @channelusername.
        required: true
      exclude_unsaved:
        description: Pass True to exclude gifts that aren't saved to the chat's profile page. Always True, unless the bot has the can_post_messages administrator right in the channel.
      exclude_saved:
        description: Pass True to exclude gifts that are saved to the chat's profile page. Always False, unless the bot has the can_post_messages administrator right in the channel.
      exclude_unlimited:
        description: Pass True to exclude gifts that can be purchased an unlimited number of times.
      exclude_limited_upgradable:
        description: Pass True to exclude gifts that can be purchased a limited number of times and can be upgraded to unique.
      exclude_limited_non_upgradable:
        description: Pass True to exclude gifts that can be purchased a limited number of times and can't be upgraded to unique.
      exclude_unique:
        description: Pass True to exclude unique gifts.
      exclude_from_blockchain:
        description: Pass True to exclude gifts that were assigned from the TON blockchain and can't be resold or transferred in Telegram.
      sort_by_price:
        description: Pass True to sort results by gift price instead of send date. Sorting is applied before pagination.
      offset:
        description: Offset of the first entry to return as received from the previous request; empty string for the first page.
      limit:
        description: The maximum number of gifts to be retrieved, 1-100. Defaults to 100.

  # ── Stickers ─────────────────────────────────────────────────────
  - name: getStickerSet
    via: restGet
    path: /bot{token}/getStickerSet
    accept: json
    params:
      name:
        description: Name of the sticker set (any public set works, e.g. one of Telegram's official sets).
        required: true

  - name: getCustomEmojiStickers
    via: restGet
    path: /bot{token}/getCustomEmojiStickers
    accept: json
    params:
      custom_emoji_ids:
        description: A JSON-serialized list of custom emoji identifiers, at most 200. Harvestable from getForumTopicIconStickers or any message entity of type custom_emoji.
        required: true

  # ── Payments (read arms) ─────────────────────────────────────────
  - name: getMyStarBalance
    via: restGet
    path: /bot{token}/getMyStarBalance
    accept: json

  - name: getStarTransactions
    via: restGet
    path: /bot{token}/getStarTransactions
    accept: json
    params:
      offset:
        description: Number of transactions to skip in the response.
      limit:
        description: Maximum number of transactions to retrieve, 1-100. Defaults to 100.

verified: 2026-09-04
---
# Telegram Bot API — read-only bot methods

The Telegram Bot API keys every method through the URL path:
`https://api.telegram.org/bot<token>/<method>` ("Making requests",
<https://core.telegram.org/bots/api#making-requests>). The bot token is
store-backed (`auth.secretPathRefs` — provision via
`/api secrets telegram.org bot_token`), filled into `{token}` at fetch
time, and redacted from every surfaced URL — the token never enters agent
context.

**Scope:** the 30 read-only `get*` methods of Bot API 10.3 (August 24,
2026) — see `endpoint-coverage-plan.md` for the full 185-method inventory
and the documented exclusions (`getManagedBotToken` returns a credential,
`getGameHighScores` needs a live game, `logOut`/`close` mutate state;
everything else is a write). No helper: the recipe surface carries the
whole shape. All ops are `restGet`; the Bot API never server-paginates —
list methods cap via `limit` (≤100) + client-supplied `offset`.

All responses share the envelope `{"ok": true, "result": ...}`; a non-`ok`
envelope or HTTP error means the token is missing or revoked — re-provision
via `/api secrets telegram.org`.

## Operations

### Identity, users & chats

- `getMe` — the bot's own identity; the canonical smoke test that the
  token resolves and the path injection works.
- `getUserProfilePhotos` / `getUserProfileAudios` — a user's profile media
  (`user_id`; paginated client-side via `offset`/`limit`).
- `getFile` — prepares a file for download; the `File` result carries a
  `file_path` for the (out-of-scope, binary) download URL.
- `getChat`, `getChatAdministrators`, `getChatMemberCount`,
  `getChatMember` — chat introspection; `chat_id` accepts a numeric id or
  `@channelusername`. `getChatMember` for *other* users requires the bot
  to be an administrator in the chat; the bot's own membership always works.
- `getUserPersonalChatMessages` — the last messages (1–20) from the
  personal chat a user has added to their profile.
- `getForumTopicIconStickers` — the custom-emoji sticker set usable as
  forum topic icons (also a source of `custom_emoji_id`s for
  `getCustomEmojiStickers`).
- `getUserChatBoosts` — boosts a user added to a chat; requires the bot to
  be an administrator in that chat.

### Business & managed-bot reads (entitlement-gated)

- `getBusinessConnection`, `getBusinessAccountStarBalance`,
  `getBusinessAccountGifts` — need an active business connection (and for
  the balance/gifts, the `can_view_gifts_and_stars` right).
- `getManagedBotAccessSettings` — for bots this bot manages.

These parse and dispatch normally; a bot without the entitlement gets a
Telegram `ok: false` error rather than an HTTP failure.

### Bot configuration reads

- `getMyCommands` (`scope` is a JSON-serialized BotCommandScope),
  `getMyName`, `getMyDescription`, `getMyShortDescription` — each
  optionally per `language_code`.
- `getChatMenuButton` — the menu button for a private chat or the default.
- `getMyDefaultAdministratorRights` — default rights in groups, or in
  channels with `for_channels: True`.

### Gifts

- `getAvailableGifts` — the catalog of gifts the bot can send.
- `getUserGifts` / `getChatGifts` — gifts owned by a user / chat, with
  the documented `exclude_*` filters and `sort_by_price`.

### Stickers

- `getStickerSet` — any public sticker set by name.
- `getCustomEmojiStickers` — up to 200 custom emoji stickers by
  JSON-serialized identifier list.

### Payments (read arms)

- `getMyStarBalance` — the bot's Telegram Stars balance.
- `getStarTransactions` — Star transaction history, client-paginated via
  `offset`/`limit`.

### Updates

- `getUpdates` — long/short polling for incoming updates; `timeout: 0`
  (the default) is short polling and safe for one-shot reads. Do not pass
  a positive `timeout` casually — the request holds the connection open.
- `getWebhookInfo` — current webhook status; pairs with `getUpdates`
  (an active webhook suppresses `getUpdates`).
