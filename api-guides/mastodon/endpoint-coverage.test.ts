/**
 * Mastodon recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * Verifies the oauth2 authorization_code + PKCE path end-to-end against the
 * live API: resolves the client_key/client_secret store secrets, reads the
 * cached user token from its slot — (mastodon.social, authorization_code,
 * tokenUrl) — injects `Authorization: Bearer`, and executes the read-only
 * op surface (timelines, accounts, statuses, notifications, filters, tags,
 * search, trends, instance metadata, annual reports).
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires provisioned
 * credentials at `/api secrets mastodon.social` (names: client_key,
 * client_secret) and a minted user token at the authorization_code slot
 * (`/api oauth mastodon.social` paste flow, umbrella `read` + `profile`
 * scopes). Mastodon access tokens carry no refresh token — re-mint via the
 * paste flow on expiry (401 "The access token is invalid").
 *
 * Sub-resource reads whose records the account does not hold (lists, v2
 * filters, notification groups, annual reports, polls, media attachments,
 * collections) are conditional or skipped: a bad id is a hard 404 "Record
 * not found", not an empty signal.
 */

import type { RestGetResult } from "pi-lean-host/core/helpers.js";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "mastodon.social";
const DIR = "mastodon";
const TOKEN_URL = "https://mastodon.social/oauth/token";

/** The token's own account (verifyCredentials) — pinned by the live suite. */
const ME_ID = "117168312080689067";
const ME_ACCT = "sofuego";

/** Pinned public account for cross-account reads (@Mastodon@mastodon.social). */
const MASTODON_ACCT = "Mastodon";
const MASTODON_ID = "13179";

/** Every operation of the guide — the structure test pins this set. */
const OP_NAMES = [
	"verifyCredentials",
	"myProfile",
	"preferences",
	"markers",
	"favourites",
	"bookmarks",
	"mutes",
	"blocks",
	"domainBlocks",
	"followRequests",
	"conversations",
	"lists",
	"list",
	"listAccounts",
	"filters",
	"filter",
	"filterKeywords",
	"filterKeyword",
	"filterStatuses",
	"filterStatus",
	"notifications",
	"oembed",
	"notification",
	"unreadNotificationCount",
	"notificationPolicy",
	"notificationRequests",
	"notificationRequest",
	"notificationRequestsMerged",
	"groupedNotifications",
	"notificationGroup",
	"notificationGroupAccounts",
	"groupedUnreadCount",
	"homeTimeline",
	"publicTimeline",
	"tagTimeline",
	"linkTimeline",
	"listTimeline",
	"account",
	"accounts",
	"accountStatuses",
	"accountFollowers",
	"accountFollowing",
	"accountFeaturedTags",
	"accountLists",
	"accountEndorsements",
	"accountCollections",
	"inCollections",
	"collection",
	"accountRelationships",
	"familiarFollowers",
	"lookupAccount",
	"searchAccounts",
	"status",
	"statuses",
	"statusContext",
	"statusSource",
	"statusHistory",
	"statusRebloggedBy",
	"statusFavouritedBy",
	"statusQuotes",
	"poll",
	"followedTags",
	"featuredTags",
	"featuredTagSuggestions",
	"tag",
	"search",
	"suggestions",
	"directory",
	"announcements",
	"instanceV2",
	"instance",
	"instancePeers",
	"instanceActivity",
	"instanceRules",
	"instanceDomainBlocks",
	"instanceExtendedDescription",
	"instancePrivacyPolicy",
	"instanceTermsOfService",
	"instanceTranslationLanguages",
	"customEmojis",
	"health",
	"trendsTags",
	"trendsStatuses",
	"trendsLinks",
	"annualReports",
	"annualReport",
	"annualReportState",
];

/**
 * Locate the Mastodon guide (dirName `mastodon`) in a temp guides dir.
 * `opName` disambiguates if sibling guides ever claim the domain.
 */
async function guideFor(guidesDir: string, opName = "verifyCredentials") {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	return findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === opName),
	)!;
}

/** Run one op of the Mastodon guide through the shared resolveOp sequence. */
async function runOp(
	guidesDir: string,
	opName: string,
	params: Record<string, unknown> = {},
) {
	const { resolveOpForExecution } = await import(
		"pi-lean-host/core/resolve-op.js"
	);
	const hit = await guideFor(guidesDir, opName);
	const op = hit.guide.operations.find((o) => o.name === opName)!;
	const outcome = await resolveOpForExecution(hit.guide, op, hit.dirName, {
		userParams: params,
	});
	expect(outcome.ok).toBe(true);
	return outcome.ok ? outcome : undefined;
}

/** Output-channel audit: a token must never surface on a surfaced URL. */
function expectNoTokenOnUrls(
	outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>,
) {
	expect((outcome.result as RestGetResult).url).not.toContain("access_token");
}

describe("Mastodon recipe structure (always-on)", () => {
	it(
		"declares the oauth2 authorization_code + PKCE shape",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/guide-catalog.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://mastodon.social");
			expect(guide.auth.kind).toBe("oauth2");
			if (guide.auth.kind !== "oauth2") return; // exhaustiveness narrowing
			expect(guide.auth.grant).toBe("authorization_code");
			expect(guide.auth.tokenUrl).toBe(TOKEN_URL);
			expect(guide.auth.authorizeUrl).toBe(
				"https://mastodon.social/oauth/authorize",
			);
			expect(guide.auth.clientId.secret).toBe("client_key");
			expect(guide.auth.clientSecret?.secret).toBe("client_secret");
			// The umbrella `read` scope expands to every read:* scope; only
			// `profile` (verify_credentials/profile) is a separate grant.
			expect(guide.auth.scopes).toEqual(["read", "profile"]);
			expect(guide.auth.tokenEndpointAuthMethod).toBe("client_secret_post");
		}),
	);

	it(
		"declares the full read-only op surface, all GET via restGet",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/guide-catalog.js"
			);
			const guide = loadApiGuidesFromDir(guidesDir).guides[DIR]!;
			const byName = new Map(guide.operations.map((o) => [o.name, o]));

			expect([...byName.keys()].sort()).toEqual([...OP_NAMES].sort());

			// Read-only guarantee: every op is restGet with no pagination —
			// Mastodon paginates via the RFC 5988 Link header, which the v1
			// pagination styles cannot follow (see the guide notes).
			for (const op of guide.operations) {
				expect(op.via).toBe("restGet");
				expect(op.pagination).toBeUndefined();
			}

			// Repeatable array params declare the clean name + `listStyle:
			// bracket` (the `[]` dress is applied at serialization); the
			// plain-text /health endpoint declares a text parse shape.
			expect(byName.get("accountRelationships")!.params).toHaveProperty("id");
			expect(byName.get("markers")!.params).toHaveProperty("timeline");
			expect(byName.get("accounts")!.params).toHaveProperty("id");
			expect(byName.get("health")!.parse?.format).toBe("text");
		}),
	);
});

describe("Mastodon live integration (oauth2 authorization_code)", () => {
	itWhen(
		"verifyCredentials returns the token's own account",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "verifyCredentials"))!;
			const account = (outcome.result as RestGetResult).data as Record<
				string,
				unknown
			>;
			// A user token (not an app token) is the whole point — an app
			// token would 422 here ("This method requires an authenticated
			// user").
			expect(account.id).toBe(ME_ID);
			expect(account.acct).toBe(ME_ACCT);
			expect(typeof account.created_at).toBe("string");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"myProfile + preferences read the token user's own settings",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const profileData = (await runOp(guidesDir, "myProfile"))!;
			const profile = (profileData.result as RestGetResult).data as Record<
				string,
				unknown
			>;
			expect(typeof profile.id).toBe("string");

			const prefs = (await runOp(guidesDir, "preferences"))!;
			expect((prefs.result as RestGetResult).data).toHaveProperty(
				"posting:default:visibility",
			);
		}),
	);

	itWhen(
		"markers returns the saved home-timeline position",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "markers", {
				timeline: "home",
			}))!;
			const d = (outcome.result as RestGetResult).data;
			expect(typeof d).toBe("object");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"home + public + tag timelines return status arrays",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const homeOutcome = (await runOp(guidesDir, "homeTimeline", {
				limit: 2,
			}))!;
			const homeStatuses = (homeOutcome.result as RestGetResult).data as Array<
				Record<string, unknown>
			>;
			expect(Array.isArray(homeStatuses)).toBe(true);
			expect(homeStatuses.length).toBeLessThanOrEqual(2);
			for (const s of homeStatuses) {
				expect(typeof s.id).toBe("string");
				expect(typeof s.content).toBe("string");
			}
			expectNoTokenOnUrls(homeOutcome);

			const pubOutcome = (await runOp(guidesDir, "publicTimeline", {
				limit: 2,
			}))!;
			const pubStatuses = (pubOutcome.result as RestGetResult).data as Array<
				Record<string, unknown>
			>;
			// mastodon.social serves the federated timeline as an empty array
			// (public timelines are disabled server-side) — the endpoint is
			// authorized but structurally empty here; assert only the array
			// + limit contract, not non-emptiness.
			expect(Array.isArray(pubStatuses)).toBe(true);
			expect(pubStatuses.length).toBeLessThanOrEqual(2);

			const tagOutcome = (await runOp(guidesDir, "tagTimeline", {
				hashtag: "mastodon",
				limit: 2,
			}))!;
			expect(Array.isArray((tagOutcome.result as RestGetResult).data)).toBe(
				true,
			);
		}),
	);

	itWhen(
		"linkTimeline reads statuses for a live trending link",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// Derive the URL from the live trending-links feed so the pin
			// can't rot (a non-trending URL is a hard 404 "Record not found").
			const linksOutcome = (await runOp(guidesDir, "trendsLinks", {
				limit: 1,
			}))!;
			const feed = (linksOutcome.result as RestGetResult).data as Array<{
				url: string;
			}>;
			if (feed.length === 0) return; // no trending links right now
			const outcome = (await runOp(guidesDir, "linkTimeline", {
				url: feed[0]!.url,
			}))!;
			expect(Array.isArray((outcome.result as RestGetResult).data)).toBe(true);
		}),
	);

	itWhen(
		"trends (tags, statuses, links) return arrays",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			for (const op of ["trendsTags", "trendsStatuses", "trendsLinks"]) {
				const outcome = (await runOp(guidesDir, op))!;
				expect(Array.isArray((outcome.result as RestGetResult).data)).toBe(
					true,
				);
			}
		}),
	);

	itWhen(
		"private mailbox lists are arrays",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			for (const op of [
				"favourites",
				"bookmarks",
				"mutes",
				"blocks",
				"domainBlocks",
				"followRequests",
				"conversations",
			]) {
				const outcome = (await runOp(guidesDir, op))!;
				expect(Array.isArray((outcome.result as RestGetResult).data)).toBe(
					true,
				);
			}
		}),
	);

	itWhen(
		"notifications v1 + grouped v2 + unread counts + policy + requests",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const notifOutcome = (await runOp(guidesDir, "notifications", {
				limit: 2,
			}))!;
			const notifs = (notifOutcome.result as RestGetResult).data as Array<
				Record<string, unknown>
			>;
			expect(Array.isArray(notifs)).toBe(true);
			expectNoTokenOnUrls(notifOutcome);

			const unreadOutcome = (await runOp(
				guidesDir,
				"unreadNotificationCount",
			))!;
			const unread = (unreadOutcome.result as RestGetResult).data as {
				count: number;
			};
			expect(typeof unread.count).toBe("number");

			const groupedOutcome = (await runOp(guidesDir, "groupedNotifications"))!;
			const groupedData = (groupedOutcome.result as RestGetResult).data as {
				notification_groups: Array<{ group_key: string }>;
			};
			expect(Array.isArray(groupedData.notification_groups)).toBe(true);

			const groupedCountOutcome = (await runOp(
				guidesDir,
				"groupedUnreadCount",
			))!;
			const groupedCount = (groupedCountOutcome.result as RestGetResult)
				.data as { count: number };
			expect(typeof groupedCount.count).toBe("number");

			const policy = (await runOp(guidesDir, "notificationPolicy"))!;
			expect(typeof (policy.result as RestGetResult).data).toBe("object");

			const requests = (await runOp(guidesDir, "notificationRequests"))!;
			expect(Array.isArray((requests.result as RestGetResult).data)).toBe(true);

			const merged = (await runOp(guidesDir, "notificationRequestsMerged"))!;
			expect((merged.result as RestGetResult).data).toHaveProperty("merged");
		}),
	);

	itWhen(
		"notification + group sub-resources read live records when present",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// A single-notification read needs a live id; skip when the
			// mailbox is empty (bad ids are hard 404s, not empty signals).
			const notifsData = (await runOp(guidesDir, "notifications", {
				limit: 1,
			}))!;
			const notifs = (notifsData.result as RestGetResult).data as Array<
				Record<string, unknown>
			>;
			if (notifs.length > 0) {
				const one = (await runOp(guidesDir, "notification", {
					id: notifs[0]!.id,
				}))!;
				expect((one.result as RestGetResult).data).toHaveProperty("id");
			}

			// Grouped-notification sub-resources need a live group_key; the
			// account's grouped feed is currently empty.
			const grouped = (await runOp(guidesDir, "groupedNotifications"))!;
			const groups = (grouped.result as RestGetResult).data as {
				notification_groups: Array<{ group_key: string }>;
			};
			if (groups.notification_groups.length > 0) {
				const key = groups.notification_groups[0]!.group_key;
				const group = (await runOp(guidesDir, "notificationGroup", {
					group_key: key,
				}))!;
				expect(group).toBeDefined();

				const accounts = (await runOp(guidesDir, "notificationGroupAccounts", {
					group_key: key,
				}))!;
				expect(Array.isArray((accounts.result as RestGetResult).data)).toBe(
					true,
				);
			}
		}),
	);

	itWhen(
		"account reads the pinned @Mastodon account; accounts(id)+relationships resolve",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const one = (await runOp(guidesDir, "account", {
				id: MASTODON_ID,
			}))!;
			const account = (one.result as RestGetResult).data as Record<
				string,
				unknown
			>;
			expect(account.id).toBe(MASTODON_ID);
			expect(account.acct).toBe(MASTODON_ACCT);
			expectNoTokenOnUrls(one);

			const multi = (await runOp(guidesDir, "accounts", {
				id: MASTODON_ID,
			}))!;
			const fetched = (multi.result as RestGetResult).data as Array<{
				id: string;
			}>;
			expect(fetched.map((a) => a.id)).toContain(MASTODON_ID);

			const relOutcome = (await runOp(guidesDir, "accountRelationships", {
				id: MASTODON_ID,
			}))!;
			const rel = (relOutcome.result as RestGetResult).data as Array<
				Record<string, unknown>
			>;
			expect(rel.length).toBe(1);
			expect(rel[0]!.id).toBe(MASTODON_ID);
			expect(rel[0]).toHaveProperty("following");

			const familiar = (await runOp(guidesDir, "familiarFollowers", {
				id: MASTODON_ID,
			}))!;
			const fam = (familiar.result as RestGetResult).data as Array<{
				id: string;
			}>;
			expect(fam[0]!.id).toBe(MASTODON_ID);
		}),
	);

	itWhen(
		"lookup + searchAccounts + search + suggestions + directory resolve",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const lookup = (await runOp(guidesDir, "lookupAccount", {
				acct: MASTODON_ACCT,
			}))!;
			const acct = (lookup.result as RestGetResult).data as {
				id: string;
			};
			expect(acct.id).toBe(MASTODON_ID);

			const searchAcct = (await runOp(guidesDir, "searchAccounts", {
				q: MASTODON_ACCT,
				limit: 2,
			}))!;
			expect(
				((searchAcct.result as RestGetResult).data as unknown[]).length,
			).toBeGreaterThan(0);

			const search = (await runOp(guidesDir, "search", {
				q: MASTODON_ACCT,
				type: "accounts",
				limit: 2,
			}))!;
			const results = (search.result as RestGetResult).data as {
				accounts: Array<{ id: string }>;
			};
			expect(results.accounts.map((a) => a.id)).toContain(MASTODON_ID);

			const suggestions = (await runOp(guidesDir, "suggestions"))!;
			expect(Array.isArray((suggestions.result as RestGetResult).data)).toBe(
				true,
			);

			const directory = (await runOp(guidesDir, "directory", {
				limit: 2,
			}))!;
			expect(
				((directory.result as RestGetResult).data as unknown[]).length,
			).toBeLessThanOrEqual(2);
		}),
	);

	itWhen(
		"account family reads on the pinned account",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const statusOutcome = (await runOp(guidesDir, "accountStatuses", {
				id: MASTODON_ID,
				limit: 2,
			}))!;
			const accountStatuses = (statusOutcome.result as RestGetResult)
				.data as Array<Record<string, unknown>>;
			expect(accountStatuses.length).toBeGreaterThan(0);
			for (const s of accountStatuses) {
				expect(s.account).toHaveProperty("acct");
			}

			const followers = (await runOp(guidesDir, "accountFollowers", {
				id: MASTODON_ID,
				limit: 2,
			}))!;
			expect(
				((followers.result as RestGetResult).data as unknown[]).length,
			).toBeLessThanOrEqual(2);

			const following = (await runOp(guidesDir, "accountFollowing", {
				id: MASTODON_ID,
				limit: 2,
			}))!;
			expect(
				((following.result as RestGetResult).data as unknown[]).length,
			).toBeLessThanOrEqual(2);

			const featured = (await runOp(guidesDir, "accountFeaturedTags", {
				id: MASTODON_ID,
			}))!;
			expect(Array.isArray((featured.result as RestGetResult).data)).toBe(true);

			const lists = (await runOp(guidesDir, "accountLists", {
				id: MASTODON_ID,
			}))!;
			expect(Array.isArray((lists.result as RestGetResult).data)).toBe(true);

			const endorsements = (await runOp(guidesDir, "accountEndorsements", {
				id: MASTODON_ID,
			}))!;
			expect(Array.isArray((endorsements.result as RestGetResult).data)).toBe(
				true,
			);

			const collections = (await runOp(guidesDir, "accountCollections", {
				account_id: MASTODON_ID,
			}))!;
			const collEnvelope = (collections.result as RestGetResult).data as {
				collections: Array<{ id: string }>;
			};
			expect(Array.isArray(collEnvelope.collections)).toBe(true);
			if (collEnvelope.collections.length > 0) {
				const one = (await runOp(guidesDir, "collection", {
					id: collEnvelope.collections[0]!.id,
				}))!;
				expect((one.result as RestGetResult).data).toHaveProperty("id");
			}

			// inCollections is excluded from live runs: mastodon.social
			// answers 403 "This action is not allowed" (collections are
			// feature-flagged off server-side; accountCollections works).
		}),
	);

	itWhen(
		"tags + featured tags resolve",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const followed = (await runOp(guidesDir, "followedTags"))!;
			expect(Array.isArray((followed.result as RestGetResult).data)).toBe(true);

			const featured = (await runOp(guidesDir, "featuredTags"))!;
			expect(Array.isArray((featured.result as RestGetResult).data)).toBe(true);

			const suggested = (await runOp(guidesDir, "featuredTagSuggestions"))!;
			expect(Array.isArray((suggested.result as RestGetResult).data)).toBe(
				true,
			);

			const tagOutcome = (await runOp(guidesDir, "tag", {
				id: "mastodon",
			}))!;
			const tag = (tagOutcome.result as RestGetResult).data as {
				name: string;
			};
			expect(tag.name).toBe("mastodon");
		}),
	);

	itWhen(
		"lists + filters are arrays; sub-resources read live records when present",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// The account currently holds no lists or filters — assert the
			// empty parents and only walk sub-resources when they exist.
			const listsOutcome = (await runOp(guidesDir, "lists"))!;
			const lists = (listsOutcome.result as RestGetResult).data as Array<{
				id: string;
			}>;
			expect(Array.isArray(lists)).toBe(true);
			if (lists.length > 0) {
				const id = lists[0]!.id;
				const one = (await runOp(guidesDir, "list", { id }))!;
				expect((one.result as RestGetResult).data).toHaveProperty("id");
				const accounts = (await runOp(guidesDir, "listAccounts", { id }))!;
				expect(Array.isArray((accounts.result as RestGetResult).data)).toBe(
					true,
				);
				const timeline = (await runOp(guidesDir, "listTimeline", {
					list_id: id,
				}))!;
				expect(Array.isArray((timeline.result as RestGetResult).data)).toBe(
					true,
				);
			}

			const filtersOutcome = (await runOp(guidesDir, "filters"))!;
			const userFilters = (filtersOutcome.result as RestGetResult)
				.data as Array<{ id: string }>;
			expect(Array.isArray(userFilters)).toBe(true);
			if (userFilters.length > 0) {
				const fid = userFilters[0]!.id;
				const one = (await runOp(guidesDir, "filter", { id: fid }))!;
				expect((one.result as RestGetResult).data).toHaveProperty("id");

				const keywords = (await runOp(guidesDir, "filterKeywords", {
					filter_id: fid,
				}))!;
				const kw = (keywords.result as RestGetResult).data as Array<{
					id: string;
				}>;
				expect(Array.isArray(kw)).toBe(true);
				if (kw.length > 0) {
					const kwOne = (await runOp(guidesDir, "filterKeyword", {
						id: kw[0]!.id,
					}))!;
					expect((kwOne.result as RestGetResult).data).toHaveProperty(
						"keyword",
					);
				}

				const statusIds = (await runOp(guidesDir, "filterStatuses", {
					filter_id: fid,
				}))!;
				const fstat = (statusIds.result as RestGetResult).data as Array<{
					id: string;
				}>;
				expect(Array.isArray(fstat)).toBe(true);
				if (fstat.length > 0) {
					const one = (await runOp(guidesDir, "filterStatus", {
						id: fstat[0]!.id,
					}))!;
					expect((one.result as RestGetResult).data).toHaveProperty(
						"status_id",
					);
				}
			}
		}),
	);

	itWhen(
		"instance family returns instance metadata",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const v2 = (await runOp(guidesDir, "instanceV2"))!;
			const v2Data = (v2.result as RestGetResult).data as {
				domain: string;
			};
			expect(v2Data.domain).toBe("mastodon.social");

			const v1 = (await runOp(guidesDir, "instance"))!;
			expect(typeof (v1.result as RestGetResult).data).toBe("object");

			const peers = (await runOp(guidesDir, "instancePeers"))!;
			expect(Array.isArray((peers.result as RestGetResult).data)).toBe(true);

			const activity = (await runOp(guidesDir, "instanceActivity"))!;
			expect(Array.isArray((activity.result as RestGetResult).data)).toBe(true);

			const rules = (await runOp(guidesDir, "instanceRules"))!;
			expect(Array.isArray((rules.result as RestGetResult).data)).toBe(true);

			const blocks = (await runOp(guidesDir, "instanceDomainBlocks"))!;
			expect(Array.isArray((blocks.result as RestGetResult).data)).toBe(true);

			for (const op of [
				"instanceExtendedDescription",
				"instancePrivacyPolicy",
				"instanceTermsOfService",
				"instanceTranslationLanguages",
			]) {
				const outcome = (await runOp(guidesDir, op))!;
				expect(typeof (outcome.result as RestGetResult).data).toBe("object");
			}
		}),
	);

	itWhen(
		"customEmojis + announcements + health respond",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const emojis = (await runOp(guidesDir, "customEmojis"))!;
			expect(Array.isArray((emojis.result as RestGetResult).data)).toBe(true);

			const announcements = (await runOp(guidesDir, "announcements"))!;
			expect(Array.isArray((announcements.result as RestGetResult).data)).toBe(
				true,
			);

			const health = (await runOp(guidesDir, "health"))!;
			expect((health.result as RestGetResult).data).toBe("OK");
		}),
	);

	itWhen(
		"oembed returns embed info for a live status URL",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// Derive the URL from the pinned account's latest post (the
			// oembed url param must be a real status URL).
			const latest = (await runOp(guidesDir, "accountStatuses", {
				id: MASTODON_ID,
				limit: 1,
			}))!;
			const latestStatus = (latest.result as RestGetResult).data as Array<{
				url: string;
			}>;
			const outcome = (await runOp(guidesDir, "oembed", {
				url: latestStatus[0]!.url,
			}))!;
			const embed = (outcome.result as RestGetResult).data as {
				type: string;
			};
			expect(embed.type).toBe("rich");
		}),
	);

	itWhen(
		"poll detail read on a live poll when the tag timeline carries one",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// One scan of a busy hashtag for a status carrying a poll; runs
			// the poll sub-resource read when found (poll ids have no
			// zero-args empty shape). GET /api/v1/media/:id is excluded — it
			// requires `write:media` (upload-processing poll), not a read.
			const scan = (await runOp(guidesDir, "tagTimeline", {
				hashtag: "mastodon",
				limit: 40,
			}))!;
			const statuses = (scan.result as RestGetResult).data as Array<{
				id: string;
				poll: { id: string } | null;
			}>;
			const withPoll = statuses.find((s) => s.poll != null);
			if (!withPoll) return; // no live poll right now
			const outcome = (await runOp(guidesDir, "poll", {
				id: withPoll.poll!.id,
			}))!;
			expect((outcome.result as RestGetResult).data).toHaveProperty("options");
		}),
	);

	itWhen(
		"annualReports returns the envelope; report sub-resources read live records when present",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const reports = (await runOp(guidesDir, "annualReports"))!;
			const envelope = (reports.result as RestGetResult).data as {
				annual_reports: Array<{ year: number }>;
			};
			expect(Array.isArray(envelope.annual_reports)).toBe(true);

			// The :year sub-resources need a live report year; the account
			// has none (bad ids are hard 404s, not empty signals).
			if (envelope.annual_reports.length > 0) {
				const year = envelope.annual_reports[0]!.year;
				const one = (await runOp(guidesDir, "annualReport", {
					year,
				}))!;
				expect((one.result as RestGetResult).data).toBeDefined();

				const state = (await runOp(guidesDir, "annualReportState", {
					year,
				}))!;
				expect((state.result as RestGetResult).data).toBeDefined();
			}
		}),
	);
});
