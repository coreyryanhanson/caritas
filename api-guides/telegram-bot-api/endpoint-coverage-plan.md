# Telegram Bot API — Endpoint Coverage Plan

> Drafted 2026-09-04 against the official Bot API reference at
> <https://core.telegram.org/bots/api> (Bot API **10.3**, changelog dated
> **August 24, 2026**; 601 anchors on the page, 185 methods after
> separating type definitions).
>
> **Selection rule:** read-only bot methods — the "research aide" use case.
> The framework transport is GET-only, and the Bot API supports GET with a
> URL query string for parameter passing ("Making requests":
> <https://core.telegram.org/bots/api#making-requests>), so every read-only
> method is expressible as `restGet`. Excludes: anything that sends, edits,
> forwards, deletes, or sets state (the overwhelming majority of the API),
> plus the four documented exceptions below.
>
> **Auth shape:** every method is keyed through the URL path
> (`/bot<token>/<method>`), backed by `auth.secretPathRefs` →
> `bot_token` in the per-domain secrets store
> (`/api secrets telegram.org bot_token`). Path refs are required-only;
> the token never enters agent context and is redacted from every
> surfaced URL (raw + `%3A` + `%3a` forms).

## Inventory summary

The reference defines **185 methods** (camelCase `h4` anchors; the rest of
the page's anchors are type definitions). Classification:

| Status | Count | Meaning |
|--------|-------|---------|
| ✅ included | **30** | read-only `get*` methods (incl. `getMe`) |
| ❌ write | 151 | send/edit/forward/copy/set/delete/answer/ban/pin/… — mutations, out of scope |
| ⛔ excluded (read-named) | 4 | documented below with citations |

### Included (30)

| # | Method | Docs section | Params of note |
|---|--------|--------------|----------------|
| 1 | `getMe` | [Available methods](https://core.telegram.org/bots/api#getme) | — |
| 2 | `getUpdates` | [Getting updates](https://core.telegram.org/bots/api#getupdates) | `offset`, `limit`, `timeout` (long polling; default 0 = short polling), `allowed_updates` (JSON-serialized Array of String) |
| 3 | `getWebhookInfo` | [Getting updates](https://core.telegram.org/bots/api#getwebhookinfo) | — |
| 4 | `getUserProfilePhotos` | [Available methods](https://core.telegram.org/bots/api#getuserprofilephotos) | `user_id` req; `offset`, `limit` |
| 5 | `getUserProfileAudios` | [Available methods](https://core.telegram.org/bots/api#getuserprofileaudios) | `user_id` req; `offset`, `limit` |
| 6 | `getFile` | [Available methods](https://core.telegram.org/bots/api#getfile) | `file_id` req. Returns `File` with a ≥1h-valid download link `https://api.telegram.org/file/bot<token>/<file_path>` — the download itself is out of scope (binary; and the same path-token shape applies) |
| 7 | `getChat` | [Available methods](https://core.telegram.org/bots/api#getchat) | `chat_id` req (Integer or `@username`) |
| 8 | `getChatAdministrators` | [Available methods](https://core.telegram.org/bots/api#getchatadministrators) | `chat_id` req; `return_bots` (Boolean) |
| 9 | `getChatMemberCount` | [Available methods](https://core.telegram.org/bots/api#getchatmembercount) | `chat_id` req |
| 10 | `getChatMember` | [Available methods](https://core.telegram.org/bots/api#getchatmember) | `chat_id` + `user_id` req; "only guaranteed to work for other users if the bot is an administrator" — verifying with the bot's own `user_id` needs no admin rights |
| 11 | `getUserPersonalChatMessages` | [Available methods](https://core.telegram.org/bots/api#getuserpersonalchatmessages) | `user_id` + `limit` (1–20) req; reads the user's profile-added personal chat |
| 12 | `getForumTopicIconStickers` | [Available methods](https://core.telegram.org/bots/api#getforumtopiciconstickers) | — |
| 13 | `getUserChatBoosts` | [Available methods](https://core.telegram.org/bots/api#getuserchatboosts) | `chat_id` + `user_id` req; **requires administrator rights in the chat** |
| 14 | `getBusinessConnection` | [Available methods](https://core.telegram.org/bots/api#getbusinessconnection) | `business_connection_id` req |
| 15 | `getManagedBotAccessSettings` | [Available methods](https://core.telegram.org/bots/api#getmanagedbotaccesssettings) | `user_id` req (of a bot this bot manages) |
| 16 | `getMyCommands` | [Available methods](https://core.telegram.org/bots/api#getmycommands) | `scope` (JSON-serialized BotCommandScope), `language_code` |
| 17 | `getMyName` | [Available methods](https://core.telegram.org/bots/api#getmyname) | `language_code` |
| 18 | `getMyDescription` | [Available methods](https://core.telegram.org/bots/api#getmydescription) | `language_code` |
| 19 | `getMyShortDescription` | [Available methods](https://core.telegram.org/bots/api#getmyshortdescription) | `language_code` |
| 20 | `getChatMenuButton` | [Available methods](https://core.telegram.org/bots/api#getchatmenubutton) | `chat_id` (Integer, optional → default menu button) |
| 21 | `getMyDefaultAdministratorRights` | [Available methods](https://core.telegram.org/bots/api#getmydefaultadministratorrights) | `for_channels` (Boolean, optional) |
| 22 | `getAvailableGifts` | [Available methods](https://core.telegram.org/bots/api#getavailablegifts) | — |
| 23 | `getBusinessAccountStarBalance` | [Available methods](https://core.telegram.org/bots/api#getbusinessaccountstarbalance) | `business_connection_id` req; requires the `can_view_gifts_and_stars` business bot right |
| 24 | `getBusinessAccountGifts` | [Available methods](https://core.telegram.org/bots/api#getbusinessaccountgifts) | `business_connection_id` req + 8 `exclude_*` filters, `sort_by_price`, `offset`, `limit` |
| 25 | `getUserGifts` | [Available methods](https://core.telegram.org/bots/api#getusergifts) | `user_id` req + 6 `exclude_*` filters, `sort_by_price`, `offset`, `limit` |
| 26 | `getChatGifts` | [Available methods](https://core.telegram.org/bots/api#getchatgifts) | `chat_id` req + 8 `exclude_*` filters, `sort_by_price`, `offset`, `limit` |
| 27 | `getStickerSet` | [Stickers](https://core.telegram.org/bots/api#getstickerset) | `name` req (any public sticker set) |
| 28 | `getCustomEmojiStickers` | [Stickers](https://core.telegram.org/bots/api#getcustomemojistickers) | `custom_emoji_ids` req (JSON-serialized Array of String, ≤200) |
| 29 | `getMyStarBalance` | [Payments](https://core.telegram.org/bots/api#getmystarbalance) | — |
| 30 | `getStarTransactions` | [Payments](https://core.telegram.org/bots/api#getstartransactions) | `offset`, `limit` |

No pagination: the Bot API never returns server-side pagination links —
list methods cap via `limit` (≤100) + client-supplied `offset`. All 30 ops
are `restGet`; the response envelope is `{"ok": true, "result": ...}` for
every method.

### Excluded, read-named (⛔ — documented reasons)

| Method | Reason | Citation |
|--------|--------|----------|
| `getManagedBotToken` | Returns a **credential** (the managed bot's token) in the response body. The framework's output-channel audit scrubs path/header/query secrets — a token delivered inside `result` would surface in agent context, re-creating the exact transcript-leak shape `secretPathRefs` exists to close. Also an entitlement/issuance action, not research data. | <https://core.telegram.org/bots/api#getmanagedbottoken> |
| `getGameHighScores` | Read-only, but requires an **active game message** (`chat_id`+`message_id` or `inline_message_id` of a game sent via `sendGame`) — scores only exist on a game the bot has posted. No game data exists to verify against; a live call is structurally `ok:false` for this bot. | <https://core.telegram.org/bots/api#getgamehighscores> |
| `logOut` | Not read-only despite the name — moves the bot out of the cloud Bot API server (destructive state change; breaks `getUpdates` until re-login). | <https://core.telegram.org/bots/api#logout> |
| `close` | Closes the bot instance (state change; must precede server migration). | <https://core.telegram.org/bots/api#close> |

### Excluded, writes (❌ — 151 methods, by docs section)

- **Getting updates** (2): `setWebhook`, `deleteWebhook`.
- **Available methods** (112): all `send*` (sendMessage … sendChecklist,
  sendDice, sendMessageDraft, sendChatAction, sendGift, sendSticker, sendGame,
  sendInvoice, …), `forwardMessage(s)`, `copyMessage(s)`, `setMessageReaction`,
  `setUserEmojiStatus`, all chat-member actions (`banChatMember`,
  `restrictChatMember`, `promoteChatMember`, `setChatAdministratorCustomTitle`,
  `setChatMemberTag`, `banSenderChat`…), all invite-link lifecycle
  (`exportChatInviteLink`, `createChat*Link`, `editChat*Link`,
  `revokeChatInviteLink`, `approve/declineChatJoinRequest`,
  `answerChatJoinRequestQuery`, `sendChatJoinRequestWebApp`), all chat-state
  setters (`setChatPhoto/Title/Description/Permissions/StickerSet`,
  `deleteChatPhoto`, `pinChatMessage`, `unpinChatMessage(s)`, `leaveChat`),
  all forum-topic lifecycle (`createForumTopic`, `edit/close/reopen/
  deleteForumTopic`, `unpinAllForumTopicMessages`, `edit/close/reopen/
  hide/unhideGeneralForumTopic`, `unpinAllGeneralForumTopicMessages`),
  `answerCallbackQuery`, `answerGuestQuery`, `replaceManagedBotToken`,
  `setManagedBotAccessSettings`, `setMyCommands`, `deleteMyCommands`,
  `setMyName`, `setMyDescription`, `setMyShortDescription`,
  `setMyProfilePhoto`, `removeMyProfilePhoto`, `setChatMenuButton`,
  `setMyDefaultAdministratorRights`, `giftPremiumSubscription`,
  `verifyUser`, `verifyChat`, `removeUserVerification`,
  `removeChatVerification`, `readBusinessMessage`, `deleteBusinessMessages`,
  all `setBusinessAccount*`/`removeBusinessAccount*`,
  `setBusinessAccountGiftSettings`, `transferBusinessAccountStars`,
  `convertGiftToStars`, `upgradeGift`, `transferGift`,
  `postStory`, `repostStory`, `editStory`, `deleteStory`,
  `answerWebAppQuery`, `savePreparedInlineMessage`,
  `savePreparedKeyboardButton`.
- **Updating messages** (19): all `edit*`, `stop*`, `deleteMessage(s)`,
  `deleteEphemeralMessage`, `deleteMessageReaction(s)`,
  `approveSuggestedPost`, `declineSuggestedPost`.
- **Stickers** (14): `sendSticker`, `uploadStickerFile`,
  `createNewStickerSet`, `addStickerToSet`, `setSticker*`, `deleteSticker*`,
  `replaceStickerInSet`, `setCustomEmojiStickerSetThumbnail`.
- **Rich messages** (2): `sendRichMessage`, `sendRichMessageDraft`.
- **Inline mode** (1): `answerInlineQuery`.
- **Payments** (6): `sendInvoice`, `createInvoiceLink`,
  `answerShippingQuery`, `answerPreCheckoutQuery`, `refundStarPayment`,
  `editUserStarSubscription`.
- **Telegram Passport** (1): `setPassportDataErrors`.
- **Games** (2): `sendGame`, `setGameScore`.

Full per-method parameter tables for the included set were extracted
programmatically from the reference page during authoring (parsed HTML →
per-method name/section/description/params); the guide's `params` blocks
mirror those tables.

## Verification data plan

`/api verify` runs every op whose required params can be satisfied. Sidecar
`verify.json` supplies live values harvested from this bot's own data
(owner `user_id`, test-group `chat_id`, `file_id`-independent ops, a public
sticker set name, custom-emoji IDs harvested from
`getForumTopicIconStickers`). Ops requiring entitlements this bot does not
have are left unsupplied → **skipped, not failed** (strict threshold
preserved for the `verified:` stamp):

- `getBusinessConnection`, `getBusinessAccountStarBalance`,
  `getBusinessAccountGifts` — need an active business connection
  (`can_connect_to_business` is `false` on this bot; see `getMe`).
- `getManagedBotAccessSettings` — this bot manages no other bots
  (`can_manage_bots` is `false`).
- `getUserPersonalChatMessages` — the owner's profile carries no personal
  channel (`USER_PERSONAL_CHANNEL_MISSING`).
- `getUserChatBoosts` — boosts apply to channels/supergroups; the test chat
  is a basic group (`PEER_ID_INVALID`), and both live tests + the plan's
  error-envelope assertions cover the documented failure shape instead.

## Verification (2026-09-04)

Single source: <https://core.telegram.org/bots/api> (fetched via `curl`,
860 KB server-rendered HTML; no WAF). Method list + parameter tables
extracted programmatically from the cached page; live behavior confirmed
through the framework pipeline (`restGet` with store-resolved path token)
against `https://api.telegram.org`.
