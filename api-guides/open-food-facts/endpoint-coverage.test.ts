/**
 * Open Food Facts recipe validity tests — endpoint coverage + live fetch
 * sanity.
 *
 * This is the numeric-`page` shape recipe: the body echoes the requested
 * page as a JSON number and paginates via 1-based `?page=N` +
 * `page_size`. The gatherAll walk asserts the `page` style advances past
 * page 1 and that the numeric `count` surfaces as `serverTotal`.
 *
 * The service is community-run: it load-sheds with HTTP 503 under load, and
 * deep pages (skip ≥ ~1000) die with misleading HTML 401/503 error pages.
 * The per-file wrapper paces every call and retries transient 503s; the
 * drain is bounded by gatherAllMax well under the deep-pagination wall.
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1.
 * Co-located with the guide it tests.
 */

import { describe, expect, it } from "vitest";
import {
	createFetchOp,
	itWhen,
	withTempDirs,
} from "../_shared/test-harness.js";

const DIR = "open-food-facts";
const DOMAIN = "world.openfoodfacts.org";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Per-recipe fetch helpers: pace + 503 retry around the shared bootstrap ──

const { HelperError } = await import("pi-lean-host/core/helpers.js");

async function with503Retry<T>(fn: () => Promise<T>): Promise<T> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await fn();
		} catch (e) {
			const transient =
				e instanceof HelperError && e.message.includes("Unexpected HTTP 503");
			if (attempt < 5 && transient) {
				await delay(5000 * (attempt + 1));
				continue;
			}
			throw e;
		}
	}
}

const _fetch = createFetchOp(DOMAIN);

async function fetchOp(
	guidesDir: string,
	name: string,
	params: Record<string, unknown> = {},
) {
	await delay(3000);
	return with503Retry(() => _fetch(guidesDir, name, params));
}

// Direct-paginate variant of the wrapper for the gatherAll drain, which
// calls `paginate` itself to pass `{ gatherAll, gatherAllMax }` opts.
async function pacedPaginate(
	guidesDir: string,
	opName: string,
	params: Record<string, unknown>,
	opts: Record<string, unknown>,
) {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	const { paginate } = await import("pi-lean-host/core/helpers.js");
	setUserGuidesDir(guidesDir);
	await delay(3000);
	const match = findGuidesByDomain(DOMAIN)[0]!;
	const op = match.guide.operations.find((o) => o.name === opName)!;
	return with503Retry(() =>
		paginate(
			match.guide.apiHost,
			op,
			params,
			match.guide,
			opts as Parameters<typeof paginate>[4],
		),
	);
}

// ═══════════════════════════════════════════════════════════════════
// Parse (bare CI — deterministic, no network)
// ═══════════════════════════════════════════════════════════════════

describe("Open Food Facts recipe parses", () => {
	it(
		"parses cleanly with the page-style pagination block",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://world.openfoodfacts.org");
			expect(guide.auth.kind).toBe("none");
			expect(guide.operations.map((o) => o.name)).toEqual(["searchProducts"]);

			const pag = guide.operations[0]!.pagination ?? guide.pagination;
			expect(pag?.style).toBe("page");
			expect(pag?.itemsPath).toBe("products");
			expect(pag?.pageParam).toBe("page");
			expect(pag?.totalCountPath).toBe("count");
		}),
	);
});

// ═══════════════════════════════════════════════════════════════════
// Live (HOST_INTEGRATION=1)
// ═══════════════════════════════════════════════════════════════════

describe("Open Food Facts live integration smoke", () => {
	itWhen(
		"searchProducts fetches a first page with the numeric count as serverTotal",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "searchProducts", {
				categories_tags_en: "Yogurts",
				page_size: 5,
				fields: "code,product_name,brands",
			})) as { items: Record<string, unknown>[]; serverTotal?: number };
			// Non-gatherAll → single page of the requested size.
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items.length).toBeLessThanOrEqual(5);
			// totalCountPath: count resolves the numeric server total.
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(0);
			const first = result.items[0]!;
			expect(typeof first["code"]).toBe("string");
			// The fields projection is honored on at least one item.
			const keys = Object.keys(first);
			expect(keys.length).toBeLessThanOrEqual(6);
		}),
		60_000,
	);

	itWhen(
		"searchProducts gatherAll walks past page 1 with incrementing ?page=N",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await pacedPaginate(
				guidesDir,
				"searchProducts",
				{
					categories_tags_en: "Yogurts",
					page_size: 10,
				},
				{ gatherAll: true, gatherAllMax: 20 },
			)) as {
				items: unknown[];
				totalFetched: number;
				pages: number;
				urls: string[];
				serverTotal?: number;
				ceilingHit: boolean;
			};
			// page_size=10, ceiling 20 → 2 pages walked, ?page=1,2 on the wire.
			expect(result.pages).toBe(2);
			expect(result.totalFetched).toBe(20);
			expect(result.ceilingHit).toBe(true);
			// 1-based page seeding + client-side increment: page=1 then page=2.
			expect(result.urls[0]).toContain("page=1");
			expect(result.urls[1]).toContain("page=2");
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(30);
		}),
		90_000,
	);
});
