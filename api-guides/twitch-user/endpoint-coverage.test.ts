/**
 * Twitch User recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * Verifies the oauth2 authorization_code path end-to-end against the live
 * API: resolves the client_id/client_secret store secrets, reads the user
 * access token from its own slot — (twitch.tv, authorization_code, tokenUrl)
 * — lazily refreshing it on expiry, injects `Authorization: Bearer` +
 * `Client-Id`, and executes the user-scope reads.
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires provisioned
 * credentials at `/api secrets twitch.tv` (names: client_id, client_secret)
 * and a minted user access token at the authorization_code slot
 * (`/api oauth twitch.tv` paste flow with the guide's scopes). The lazy
 * refresh keeps an expired token alive — no re-consent needed per run.
 *
 * Several endpoints return the API's "empty" signal as a documented 404
 * (streamMarkers with no recent VOD, hypeTrain with no hype train) — those
 * tests accept 200-with-data OR the empty-signal 404, never other statuses.
 */

import type {
	PaginateResult,
	RestGetResult,
} from "pi-lean-host/core/helpers.js";
import { HelperError } from "pi-lean-host/core/helpers.js";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "twitch.tv";
const DIR = "twitch-user";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
/** The token's own user — every endpoint here reads the token user's data. */
const ME = "1383401462";

/**
 * Locate the Twitch User guide (dirName `twitch-user`) in a temp guides dir.
 * `opName` disambiguates from the sibling app-token guide (`twitch`), which
 * claims the same domain.
 */
async function guideFor(guidesDir: string, opName = "me") {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	return findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === opName),
	)!;
}

/** Run one op of the Twitch User guide through the shared resolveOp sequence. */
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

/**
 * Run one op that may legitimately return the documented 404 empty signal
 * (no recent VOD / no hype train). Resolves to the executor result on 200,
 * or `{ notFound: true }` when the API answers the documented empty-signal
 * 404. Any other status rethrows.
 */
async function runOpOrEmpty404(
	guidesDir: string,
	opName: string,
	params: Record<string, unknown> = {},
): Promise<
	| { notFound: false; outcome: NonNullable<Awaited<ReturnType<typeof runOp>>> }
	| { notFound: true; outcome: undefined }
> {
	try {
		return {
			notFound: false,
			outcome: (await runOp(guidesDir, opName, params))!,
		};
	} catch (e) {
		if (e instanceof HelperError && e.found === "404") {
			return { notFound: true, outcome: undefined };
		}
		throw e;
	}
}

/** Output-channel audit: a token must never surface on a surfaced URL. */
function expectNoTokenOnUrls(
	outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>,
) {
	const result = outcome.result as RestGetResult | PaginateResult;
	const urls = "urls" in result ? result.urls : [result.url];
	for (const u of urls) expect(u).not.toContain("access_token");
}

describe("Twitch User recipe structure (always-on)", () => {
	it(
		"declares the oauth2 authorization_code shape",
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
			expect(guide.auth.grant).toBe("authorization_code");
			expect(guide.auth.tokenUrl).toBe(TOKEN_URL);
			expect(guide.auth.authorizeUrl).toBe(
				"https://id.twitch.tv/oauth2/authorize",
			);
			expect(guide.auth.revokeUrl).toBe("https://id.twitch.tv/oauth2/revoke");
			expect(guide.auth.clientId.secret).toBe("client_id");
			expect(guide.auth.clientSecret?.secret).toBe("client_secret");
			expect(guide.auth.tokenEndpointAuthMethod).toBe("client_secret_post");
			expect(guide.auth.secretRefs?.["Client-Id"].secret).toBe("client_id");
			expect(guide.auth.scopes).toEqual([
				"channel:read:goals",
				"channel:read:hype_train",
				"channel:read:redemptions",
				"channel:read:subscriptions",
				"moderator:read:chatters",
				"moderator:read:followers",
				"user:read:broadcast",
				"user:read:email",
				"user:read:follows",
			]);
		}),
	);

	it(
		"declares every read-only user-token operation",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const guide = loadApiGuidesFromDir(guidesDir).guides[DIR]!;
			const byName = new Map(guide.operations.map((o) => [o.name, o]));

			expect([...byName.keys()].sort()).toEqual(
				[
					"me",
					"followedStreams",
					"channelFollowers",
					"streamMarkers",
					"goals",
					"hypeTrain",
					"chatters",
					"subscriptions",
				].sort(),
			);

			// Mutually exclusive selectors ride requiresAnyOf.
			expect(byName.get("streamMarkers")!.requiresAnyOf).toEqual([
				"user_id",
				"video_id",
			]);

			// Required params: every broadcaster/moderator-scoped read pins the
			// token user; me takes none.
			expect(byName.get("me")!.params).toEqual({});
			for (const [name, required] of [
				["followedStreams", ["user_id"]],
				["channelFollowers", ["broadcaster_id"]],
				["goals", ["broadcaster_id"]],
				["hypeTrain", ["broadcaster_id"]],
				["chatters", ["broadcaster_id", "moderator_id"]],
				["subscriptions", ["broadcaster_id"]],
			] as const) {
				const params = byName.get(name)!.params!;
				const gotRequired = Object.entries(params)
					.filter(([, p]) => p.required)
					.map(([k]) => k);
				expect(gotRequired).toEqual(required);
			}

			// All paginate ops share the Helix cursor shape.
			for (const name of [
				"followedStreams",
				"channelFollowers",
				"streamMarkers",
				"chatters",
				"subscriptions",
			]) {
				const p = byName.get(name)!.pagination!;
				expect(p.style).toBe("cursor");
				expect(p.cursorParam).toBe("after");
				expect(p.cursorPath).toBe("pagination.cursor");
			}
			// Collection endpoints expose the server-side total.
			for (const name of ["channelFollowers", "chatters", "subscriptions"]) {
				expect(byName.get(name)!.pagination!.totalCountPath).toBe("total");
			}
		}),
	);

	it(
		"keeps op names disjoint from the sibling app-token guide (twitch)",
		withTempDirs(
			"twitch",
			"twitch-user",
		)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides).sort()).toEqual([
				"twitch",
				"twitch-user",
			]);
			const appGuide = loaded.guides["twitch"]!;
			const userGuide = loaded.guides["twitch-user"]!;
			const appNames = new Set(appGuide.operations.map((o) => o.name));
			const userNames = userGuide.operations.map((o) => o.name);
			// api-fetch resolves ops by name across every guide claiming the
			// domain — a duplicate name would be an ambiguous-collision error.
			expect(userNames.filter((n) => appNames.has(n))).toEqual([]);
		}),
	);
});

describe("Twitch User live integration (oauth2 authorization_code)", () => {
	itWhen(
		"me returns the token's own user incl. verified email",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "me"))!;
			const data = (outcome.result as RestGetResult).data as {
				data: Array<Record<string, unknown>>;
			};
			expect(data.data).toHaveLength(1);
			expect(data.data[0]!.login).toBe("mysteryshadesman");
			expect(data.data[0]!.id).toBe(ME);
			// user:read:email is minted — the no-param lookup returns it.
			expect(typeof data.data[0]!.email).toBe("string");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"followedStreams reads the token user's followed live streams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "followedStreams", {
				user_id: ME,
				first: 5,
			}))!;
			const items = (outcome.result as PaginateResult).items as Array<
				Record<string, unknown>
			>;
			expect(Array.isArray(items)).toBe(true);
			for (const s of items) {
				expect(typeof s.user_login).toBe("string");
				expect(typeof s.game_name).toBe("string");
			}
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"channelFollowers reads the token user's own followers",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "channelFollowers", {
				broadcaster_id: ME,
				first: 5,
			}))!;
			const result = outcome.result as PaginateResult;
			const items = result.items as Array<Record<string, unknown>>;
			expect(Array.isArray(items)).toBe(true);
			for (const f of items) {
				expect(typeof f.user_id).toBe("string");
				expect(typeof f.followed_at).toBe("string");
			}
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"streamMarkers returns markers or the documented no-recent-VOD 404",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { notFound, outcome } = await runOpOrEmpty404(
				guidesDir,
				"streamMarkers",
				{
					user_id: ME,
				},
			);
			if (!notFound) {
				const items = (outcome!.result as PaginateResult).items as Array<
					Record<string, unknown>
				>;
				expect(Array.isArray(items)).toBe(true);
				expectNoTokenOnUrls(outcome!);
			}
			// else: the documented empty signal — "Unable to find user's most
			// recent Video/VOD ID" (HTTP 404) when no VOD exists.
		}),
	);

	itWhen(
		"goals reads the token user's creator goals (empty list ok)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "goals", {
				broadcaster_id: ME,
			}))!;
			const data = (outcome.result as RestGetResult).data as {
				data: Array<Record<string, unknown>>;
			};
			expect(Array.isArray(data.data)).toBe(true);
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"hypeTrain returns status or the documented no-hype-train 404",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { notFound, outcome } = await runOpOrEmpty404(
				guidesDir,
				"hypeTrain",
				{
					broadcaster_id: ME,
				},
			);
			if (!notFound) {
				const data = (outcome!.result as RestGetResult).data as {
					data: unknown[];
				};
				expect(Array.isArray(data.data)).toBe(true);
				expectNoTokenOnUrls(outcome!);
			}
		}),
	);

	itWhen(
		"chatters reads the token user's chat session (broadcaster as moderator)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "chatters", {
				broadcaster_id: ME,
				moderator_id: ME,
				first: 5,
			}))!;
			const result = outcome.result as PaginateResult;
			const items = result.items as Array<Record<string, unknown>>;
			expect(Array.isArray(items)).toBe(true);
			for (const c of items) {
				expect(typeof c.user_id).toBe("string");
				expect(typeof c.user_login).toBe("string");
			}
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"subscriptions reads the token user's subscriber list",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "subscriptions", {
				broadcaster_id: ME,
				first: 5,
			}))!;
			const result = outcome.result as PaginateResult;
			const items = result.items as Array<Record<string, unknown>>;
			expect(Array.isArray(items)).toBe(true);
			for (const s of items) {
				expect(typeof s.tier).toBe("string");
			}
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"multi-grant slots coexist: app-token op doesn't clobber the user-token slot",
		withTempDirs(
			"twitch",
			"twitch-user",
		)(async ({ guidesDir }) => {
			// Run one app-token op (the sibling guide's client_credentials
			// read — mints when its slot is empty), then two user-token ops.
			// Under the pre-2.9 domain-keyed store the app-token write wiped
			// the user slot and the second me() failed (no refreshable
			// token, no silent re-mint for authorization_code). Two
			// coexisting slots = pass.
			const { resolveOpForExecution } = await import(
				"pi-lean-host/core/resolve-op.js"
			);
			const hit = await guideFor(guidesDir, "topGames");
			const op = hit.guide.operations.find((o) => o.name === "topGames")!;
			const outcome = await resolveOpForExecution(hit.guide, op, hit.dirName, {
				userParams: { first: 1 },
			});
			expect(outcome.ok).toBe(true);

			// Second user-token read rides the surviving slot.
			await runOp(guidesDir, "me");
		}),
	);
});
