/**
 * Stripe recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * This is the Sprint-2 live proof of the P0-3 `hasMorePath` half: the
 * `has_more` + `starting_after = data[-1].id` walk executed end-to-end
 * against the real Stripe API with a read-only restricted key.
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires a
 * provisioned restricted key at `/api secrets stripe.com`.
 *
 * Assertions are deliberately value-agnostic: envelope mechanics and
 * pagination behavior only, never record contents — the account's data
 * differs per key, so no expected id/email/count is hardcoded.
 */

import { loadApiGuidesFromDir } from "pi-lean-host/core/parse-api-guide.js";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "stripe.com";
const DIR = "stripe";

/** Point the guide store at the temp copy and resolve the Stripe guide. */
async function loadGuide(guidesDir: string) {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	return findGuidesByDomain(DOMAIN).at(-1)!.guide;
}

/** Resolve the stored key-injected auth opts for live calls. */
async function authFor(guide: Awaited<ReturnType<typeof loadGuide>>) {
	const { resolveSecretHeaders } = await import("pi-lean-host/core/auth.js");
	const res = resolveSecretHeaders(guide.auth, DOMAIN);
	expect(res.absentRequired).toEqual([]);
	expect(res.headers["Authorization"]).toMatch(/^Bearer /);
	return {
		authHeaders: res.headers,
		secretHeaderNames: new Set(["Authorization"]),
		secretValues: Object.values(res.headers),
	};
}

describe("Stripe recipe (structure — always runs)", () => {
	it("parses cleanly and pins the hasMorePath cursor block", () => {
		// Real loader path — proves the folder-name = slug(shortName) identity
		// (parseApiGuide alone can't see the folder). Scoped to stripe: only
		// assert that stripe loads and is NOT routed malformed; other guides'
		// health is all-guides-parse.test.ts's job, not this file's.
		const loaded = loadApiGuidesFromDir(
			new URL("..", import.meta.url).pathname,
		);
		expect(loaded.guides[DIR]).toBeTruthy();
		expect(loaded.malformed.some((m) => m.filename === DIR)).toBe(false);
		const guide = loaded.guides[DIR]!;
		expect(guide.domains).toContain(DOMAIN);
		expect(guide.auth.kind).toBe("static-key");
		expect(guide.auth.secretRefs).toEqual({
			Authorization: { secret: "restricted_key", prefix: "Bearer " },
		});

		const op = guide.operations.find((o) => o.name === "listCustomers")!;
		expect(op.path).toBe("/v1/customers");
		expect(op.via).toBe("paginate");
		const pag = guide.pagination;
		expect(pag?.style).toBe("cursor");
		expect(pag?.cursorParam).toBe("starting_after");
		expect(pag?.cursorPath).toBe("data[-1].id");
		expect(pag?.hasMorePath).toBe("has_more");
		expect(pag?.itemsPath).toBe("data");
	});
});

describe("Stripe live integration (authenticated)", () => {
	itWhen(
		"listCustomers fetches a single page with the key injected from the store",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const op = guide.operations.find((o) => o.name === "listCustomers")!;
			const auth = await authFor(guide);
			const result = await paginate(guide.apiHost, op, {}, guide, auth);
			// Single page (no gatherAll): one request, well-formed items.
			expect(result.pages).toBe(1);
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);
			const first = result.items[0] as Record<string, unknown>;
			expect(typeof first["id"]).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"gatherAll walk terminates cleanly via has_more (no ceiling, cursor advances, no overlap)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const op = guide.operations.find((o) => o.name === "listCustomers")!;
			const auth = await authFor(guide);
			const result = await paginate(guide.apiHost, op, {}, guide, {
				...auth,
				gatherAll: true,
			});
			// Clean stop: the done-flag fired, not the ceiling.
			expect(result.ceilingHit).toBe(false);
			expect(result.pages).toBeGreaterThanOrEqual(1);
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);

			// Cursor advance + non-overlap, computed from the walk itself
			// (no hardcoded ids — the account's data is key-specific).
			const pageSize = guide.pagination?.pageSize ?? 10;
			const pageIds: string[][] = [];
			for (let p = 0; p < result.pages; p++) {
				const slice = result.items.slice(
					p * pageSize,
					(p + 1) * pageSize,
				) as Record<string, unknown>[];
				pageIds.push(slice.map((c) => c["id"] as string));
			}
			const seen = new Set<string>();
			for (const ids of pageIds) {
				for (const id of ids) {
					expect(seen.has(id)).toBe(false);
					seen.add(id);
				}
			}
			// Every request after the first carries
			// starting_after = the previous page's last id.
			for (let p = 1; p < pageIds.length; p++) {
				const lastPrev = pageIds[p - 1]![pageIds[p - 1]!.length - 1];
				expect(decodeURIComponent(result.urls[p]!)).toContain(
					`starting_after=${lastPrev}`,
				);
			}
			// The secret never surfaces on any channel.
			for (const url of result.urls) {
				for (const v of auth.secretValues) expect(url).not.toContain(v);
			}
		}),
		60_000,
	);
});
