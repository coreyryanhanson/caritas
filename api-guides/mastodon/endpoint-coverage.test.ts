/**
 * Mastodon recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * Verifies the oauth2 authorization_code + PKCE path end-to-end against the
 * live API: resolves the client_key/client_secret store secrets, reads the
 * cached user token (minted once via /api oauth init — the paste flow), and
 * executes the user-scoped read.
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires a minted
 * user token (scope: read) in the mastodon.social token store and
 * provisioned credentials at `/api secrets mastodon.social` (names:
 * client_key, client_secret).
 */

import type { RestGetResult } from "pi-lean-host/core/helpers.js";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "mastodon.social";
const DIR = "mastodon";

/** Locate the Mastodon guide in a temp guides dir. */
async function guideFor(guidesDir: string) {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	return findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === "verifyCredentials"),
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
	const hit = await guideFor(guidesDir);
	const op = hit.guide.operations.find((o) => o.name === opName)!;
	const outcome = await resolveOpForExecution(hit.guide, op, hit.dirName, {
		userParams: params,
	});
	expect(outcome.ok).toBe(true);
	return outcome.ok ? outcome : undefined;
}

/** Data body of a restGet op. */
function dataOf(outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>) {
	return (outcome.result as RestGetResult).data as Record<string, unknown>;
}

describe("Mastodon recipe structure (always-on)", () => {
	it(
		"declares the oauth2 authorization_code + PKCE shape",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://mastodon.social");
			expect(guide.auth.kind).toBe("oauth2");
			if (guide.auth.kind !== "oauth2") return; // exhaustiveness narrowing
			expect(guide.auth.grant).toBe("authorization_code");
			expect(guide.auth.tokenUrl).toBe("https://mastodon.social/oauth/token");
			expect(guide.auth.authorizeUrl).toBe(
				"https://mastodon.social/oauth/authorize",
			);
			expect(guide.auth.clientId.secret).toBe("client_key");
			expect(guide.auth.clientSecret?.secret).toBe("client_secret");
			expect(guide.auth.scopes).toEqual(["read"]);
			expect(guide.auth.tokenEndpointAuthMethod).toBe("client_secret_post");
		}),
	);

	it(
		"declares the user-token read operations",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const guide = loadApiGuidesFromDir(guidesDir).guides[DIR]!;
			expect(guide.operations.map((o) => o.name)).toEqual([
				"verifyCredentials",
			]);
		}),
	);
});

describe("Mastodon live integration (oauth2)", () => {
	itWhen(
		"verifyCredentials returns the token's own account",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "verifyCredentials"))!;
			const account = dataOf(outcome);
			expect(typeof account.id).toBe("string");
			expect(typeof account.username).toBe("string");
			expect(typeof account.acct).toBe("string");
			// A user token (not an app token) is the whole point — an app
			// token would 422 here ("This method requires an authenticated
			// user").
			expect(String(account.id).length).toBeGreaterThan(0);
		}),
	);
});
