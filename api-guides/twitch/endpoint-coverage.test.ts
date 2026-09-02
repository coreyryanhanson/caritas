/**
 * Twitch recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * Verifies the oauth2 client_credentials path end-to-end against the live
 * API: resolves the client_id/client_secret store secrets, mints (or reuses
 * a cached) app access token, injects `Authorization: Bearer` +
 * `Client-Id`, and executes the reads.
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires provisioned
 * credentials at `/api secrets twitch.tv` (names: client_id, client_secret).
 */

import type {
	PaginateResult,
	RestGetResult,
} from "pi-lean-host/core/helpers.js";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "twitch.tv";
const DIR = "twitch";

/** Locate the Twitch guide in a temp guides dir. */
async function guideFor(guidesDir: string) {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	return findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === "topGames"),
	)!;
}

/** Run one op of the Twitch guide through the shared resolveOp sequence. */
async function runOp(
	guidesDir: string,
	opName: string,
	params: Record<string, unknown> = {},
) {
	const { resolveOpForExecution } = await import(
		"pi-lean-host/core/resolve-op.js"
	);
	const hit = await guideFor(guidesDir);
	const op = hit.guide.operations.find((o) => o.name === opName)!;
	const outcome = await resolveOpForExecution(hit.guide, op, hit.dirName, {
		userParams: params,
	});
	expect(outcome.ok).toBe(true);
	return outcome.ok ? outcome : undefined;
}

/** The executor result of a completed runOp (narrowed, non-undefined). */
function resultOf(outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>) {
	return outcome.result as PaginateResult | RestGetResult;
}

/** Data body of a restGet op. */
function dataOf(outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>) {
	return (resultOf(outcome) as RestGetResult).data as {
		data: unknown[];
	};
}

/** items array of a paginate op. */
function itemsOf(outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>) {
	return (resultOf(outcome) as PaginateResult).items;
}

/** Output-channel audit: a token must never surface on a surfaced URL. */
function expectNoTokenOnUrls(
	outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>,
) {
	for (const u of resultOf(outcome).urls)
		expect(u).not.toContain("access_token");
}

describe("Twitch recipe structure (always-on)", () => {
	it(
		"declares the oauth2 client_credentials shape",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://api.twitch.tv");
			expect(guide.auth.kind).toBe("oauth2");
			if (guide.auth.kind !== "oauth2") return; // exhaustiveness narrowing
			expect(guide.auth.grant).toBe("client_credentials");
			expect(guide.auth.tokenUrl).toBe("https://id.twitch.tv/oauth2/token");
			expect(guide.auth.clientId.secret).toBe("client_id");
			expect(guide.auth.clientSecret?.secret).toBe("client_secret");
			expect(guide.auth.tokenEndpointAuthMethod).toBe("client_secret_post");
			expect(guide.auth.secretRefs?.["Client-Id"].secret).toBe("client_id");
		}),
	);

	it(
		"declares every read-only app-token operation",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const guide = loadApiGuidesFromDir(guidesDir).guides[DIR]!;
			const byName = new Map(guide.operations.map((o) => [o.name, o]));

			expect([...byName.keys()].sort()).toEqual(
				[
					"topGames",
					"games",
					"searchCategories",
					"searchChannels",
					"streams",
					"users",
					"channelInfo",
					"clips",
					"videos",
					"schedule",
					"teams",
					"channelTeams",
					"cheermotes",
					"chatEmotesGlobal",
					"chatEmotes",
					"chatEmoteSets",
					"chatBadgesGlobal",
					"chatBadges",
					"contentClassificationLabels",
					"eventSubSubscriptions",
				].sort(),
			);

			// Mutually exclusive selectors ride requiresAnyOf.
			for (const [name, members] of [
				["games", ["id", "name", "igdb_id"]],
				["clips", ["broadcaster_id", "game_id", "id"]],
				["videos", ["id", "user_id", "game_id"]],
				["teams", ["name", "id"]],
				["users", ["id", "login"]],
			] as const) {
				expect(byName.get(name)!.requiresAnyOf).toEqual(members);
			}

			// All paginate ops share the Helix cursor shape.
			for (const name of [
				"topGames",
				"searchCategories",
				"searchChannels",
				"streams",
				"clips",
				"videos",
				"schedule",
				"eventSubSubscriptions",
			]) {
				const p = byName.get(name)!.pagination!;
				expect(p.style).toBe("cursor");
				expect(p.cursorParam).toBe("after");
				expect(p.cursorPath).toBe("pagination.cursor");
			}
			// schedule's items live one level deeper.
			expect(byName.get("schedule")!.pagination!.itemsPath).toBe(
				"data.segments",
			);

			// RFC 3339 date params ride the core dateParams formatter.
			const clips = byName.get("clips")!;
			expect(clips.dateParams?.started_at).toBe("iso8601");
			expect(clips.dateParams?.ended_at).toBe("iso8601");
			expect(byName.get("schedule")!.dateParams?.start_time).toBe("iso8601");
		}),
	);
});

describe("Twitch live integration (oauth2)", () => {
	itWhen(
		"topGames fetches a page with the app token + Client-Id injected",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "topGames", { first: 5 }))!;
			const items = itemsOf(outcome) as Array<Record<string, unknown>>;
			expect(items).toHaveLength(5);
			for (const g of items) {
				expect(typeof g.id).toBe("string");
				expect(typeof g.name).toBe("string");
			}
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"topGames cursor pagination advances (page 2 via pagination.cursor)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { restGet } = await import("pi-lean-host/core/helpers.js");
			// The paginate executor consumes the cursor internally; grab the
			// raw page-1 cursor with a direct restGet (auth opts from runOp).
			const first = await runOp(guidesDir, "topGames", { first: 2 });
			const hit = await guideFor(guidesDir);
			const op = hit.guide.operations.find((o) => o.name === "topGames")!;
			const raw1 = await restGet(
				hit.guide.apiHost,
				op,
				{ first: 2 },
				hit.guide,
				first!.authOpts,
			);
			const cursor = (raw1.data as { pagination?: { cursor?: string } })
				.pagination?.cursor;
			expect(cursor).toBeTruthy();
			const page2 = await runOp(guidesDir, "topGames", {
				first: 2,
				after: cursor,
			});
			const page1Items = itemsOf(first!) as Array<Record<string, unknown>>;
			const page2Items = itemsOf(page2!) as Array<Record<string, unknown>>;
			expect(page2Items).toHaveLength(2);
			expect(page2Items[0]!.id).not.toBe(page1Items[0]!.id);
		}),
	);

	itWhen(
		"streams lists live streams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "streams", { first: 2 }))!;
			const items = itemsOf(outcome) as Array<Record<string, unknown>>;
			expect(items).toHaveLength(2);
			for (const s of items) {
				expect(typeof s.user_login).toBe("string");
				expect(typeof s.game_name).toBe("string");
			}
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"games resolves by id",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "games", { id: "509658" }))!;
			const data = dataOf(outcome);
			expect(data.data[0]!.id).toBe("509658");
			expect(data.data[0]!.name).toBe("Just Chatting");
		}),
	);

	itWhen(
		"searchCategories matches a query",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "searchCategories", {
				query: "fortnite",
				first: 3,
			}))!;
			const items = itemsOf(outcome) as Array<Record<string, unknown>>;
			expect(items.length).toBeGreaterThan(0);
			expect(typeof items[0]!.id).toBe("string");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"searchChannels matches channels and reports is_live",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "searchChannels", {
				query: "ninja",
				first: 3,
			}))!;
			const items = itemsOf(outcome) as Array<Record<string, unknown>>;
			expect(items.length).toBeGreaterThan(0);
			expect(items[0]!.broadcaster_login).toContain("ninja");
			expect(typeof items[0]!.is_live).toBe("boolean");
		}),
	);

	itWhen(
		"users resolves by login",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "users", { login: "twitch" }))!;
			const data = dataOf(outcome);
			expect(data.data[0]!.id).toBe("12826");
			expect(data.data[0]!.login).toBe("twitch");
		}),
	);

	itWhen(
		"channelInfo reads a channel by broadcaster_id",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "channelInfo", {
				broadcaster_id: "12826",
			}))!;
			const data = dataOf(outcome);
			expect(data.data[0]!.broadcaster_id).toBe("12826");
		}),
	);

	itWhen(
		"clips filters by game_id",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "clips", {
				game_id: "509658",
				first: 3,
			}))!;
			const items = itemsOf(outcome) as Array<Record<string, unknown>>;
			expect(items).toHaveLength(3);
			expect(typeof items[0]!.url).toBe("string");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"videos filters by game_id",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "videos", {
				game_id: "509658",
				first: 3,
			}))!;
			expect(itemsOf(outcome)).toHaveLength(3);
		}),
	);

	itWhen(
		"schedule reads segments for a broadcaster with a schedule",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "schedule", {
				broadcaster_id: "92038375",
			}))!;
			const items = itemsOf(outcome) as Array<Record<string, unknown>>;
			expect(items.length).toBeGreaterThan(0);
			expect(typeof items[0]!.start_time).toBe("string");
		}),
	);

	itWhen(
		"teams resolves by name",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "teams", { name: "twitch" }))!;
			const data = dataOf(outcome);
			expect(Array.isArray(data.data[0]!.users)).toBe(true);
		}),
	);

	itWhen(
		"channelTeams lists a broadcaster's teams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "channelTeams", {
				broadcaster_id: "12826",
			}))!;
			const data = dataOf(outcome);
			expect(data.data[0]!.broadcaster_id).toBe("12826");
		}),
	);

	itWhen(
		"cheermotes lists global tiers",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "cheermotes"))!;
			const data = dataOf(outcome);
			expect((data.data[0] as Record<string, unknown>).prefix).toBe("Cheer");
		}),
	);

	itWhen(
		"global chat emotes + badges",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const glob = (await runOp(guidesDir, "chatEmotesGlobal"))!;
			expect(dataOf(glob).data.length).toBeGreaterThan(0);

			const badges = (await runOp(guidesDir, "chatBadgesGlobal"))!;
			expect(dataOf(badges).data.length).toBeGreaterThan(0);
		}),
	);

	itWhen(
		"per-channel chat emotes, emote sets, badges",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const em = (await runOp(guidesDir, "chatEmotes", {
				broadcaster_id: "12826",
			}))!;
			expect(dataOf(em).data.length).toBeGreaterThan(0);

			const sets = (await runOp(guidesDir, "chatEmoteSets", {
				emote_set_id: "0",
			}))!;
			expect(dataOf(sets).data.length).toBeGreaterThan(0);

			const cb = (await runOp(guidesDir, "chatBadges", {
				broadcaster_id: "12826",
			}))!;
			expect(dataOf(cb).data.length).toBeGreaterThan(0);
		}),
	);

	itWhen(
		"contentClassificationLabels lists labels",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "contentClassificationLabels"))!;
			const data = dataOf(outcome) as {
				data: Array<Record<string, unknown>>;
			};
			expect(data.data.length).toBeGreaterThan(0);
			expect(typeof data.data[0]!.id).toBe("string");
		}),
	);

	itWhen(
		"eventSubSubscriptions lists the app's subscriptions (empty ok)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "eventSubSubscriptions"))!;
			expect(Array.isArray(itemsOf(outcome))).toBe(true);
			expectNoTokenOnUrls(outcome);
		}),
	);
});
