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

import type { PaginateResult } from "pi-lean-host/core/helpers.js";
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

describe("Twitch recipe structure (always-on)", () => {
	it(
		"declares the operations and the oauth2 client_credentials shape",
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
			expect(guide.operations.map((o) => o.name)).toContain("topGames");
		}),
	);
});

describe("Twitch live integration (oauth2)", () => {
	itWhen(
		"topGames fetches a page with the app token + Client-Id injected",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = await runOp(guidesDir, "topGames", { first: 5 });
			const result = outcome!.result as PaginateResult;
			expect(result.urls.length).toBe(1);
			const items = result.items as Array<Record<string, unknown>>;
			expect(items.length).toBe(5);
			for (const g of items) {
				expect(typeof g.id).toBe("string");
				expect(typeof g.name).toBe("string");
			}
			// Output-channel audit: the access token never surfaces on a URL.
			for (const u of result.urls) expect(u).not.toContain("access_token");
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
			const page1Items = (first!.result as PaginateResult).items as Array<
				Record<string, unknown>
			>;
			const page2Items = (page2!.result as PaginateResult).items as Array<
				Record<string, unknown>
			>;
			expect(page2Items).toHaveLength(2);
			expect(page2Items[0]!.id).not.toBe(page1Items[0]!.id);
		}),
	);
});
