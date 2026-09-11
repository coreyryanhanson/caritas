/**
 * Open Food Facts recipe validity tests — endpoint coverage + live fetch
 * sanity.
 *
 * This is the numeric-`page` shape recipe: the body echoes the requested
 * page as a JSON number and paginates via 1-based `?page=N` +
 * `page_size`. The gatherAll walk asserts the `page` style advances past
 * page 1 and that the numeric `count` surfaces as `serverTotal`.
 *
 * Covers all 9 ops: 4 product reads (by barcode / paginated search / bulk
 * codes / ingredients OCR), 3 taxonomy + personal-search metadata reads,
 * 2 legacy cgi lookup helpers.
 *
 * The service is community-run: it load-sheds with HTTP 503 under load,
 * and deep pages (skip ≥ ~1000) die with misleading HTML 401/503 error
 * pages. The per-file wrapper paces every call and retries transient 503s;
 * the drain is bounded by the guide's gatherAllMax (480) well under the
 * deep-pagination wall.
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

// ── Stable anchors (live-probed 2026-09-03) ─────────────────────────
const BARCODE = "3017620422003"; // Nutella — the docs' canonical example
const CODE_A = "3263859883713"; // Fonds artichauts
const CODE_B = "8437011606013"; // Sucrine 3 pièces

// ═══════════════════════════════════════════════════════════════════
// Parse (bare CI — deterministic, no network)
// ═══════════════════════════════════════════════════════════════════

describe("Open Food Facts recipe parses", () => {
	it(
		"parses cleanly with the page-style pagination block and all 9 ops",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/guide-catalog.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://world.openfoodfacts.org");
			expect(guide.auth.kind).toBe("none");
			expect(guide.operations).toHaveLength(9);
			const names = guide.operations.map((o) => o.name);
			expect(names).toEqual([
				"getProduct",
				"searchProducts",
				"getProductsByCodes",
				"extractIngredientsOcr",
				"getTaxonomyEntries",
				"listAttributeGroups",
				"listPreferences",
				"suggestTags",
				"getNutrientsTree",
			]);

			// Guide-level pagination: the numeric-page shape.
			const pag = guide.pagination;
			expect(pag?.style).toBe("page");
			expect(pag?.itemsPath).toBe("products");
			expect(pag?.pageParam).toBe("page");
			expect(pag?.pageSizeParam).toBe("page_size");
			expect(pag?.pageSize).toBe(24);
			expect(pag?.totalCountPath).toBe("count");
			// Deep-pagination wall: 20 pages × 24 stays under skip ≥ 1000.
			expect(guide.gatherAllMax).toBe(480);
		}),
	);
});

// ═══════════════════════════════════════════════════════════════════
// Baseline — the numeric-page pagination proofs
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

	itWhen(
		"passthrough forwards undeclared tag filters (OR grammar) onto the wire",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "searchProducts", {
				nutrition_grades_tags: "a|b",
				page_size: 3,
				fields: "code,nutrition_grades",
			})) as { items: { nutrition_grades?: string }[] };
			expect(result.items.length).toBeGreaterThan(0);
			for (const item of result.items) {
				expect(["a", "b"]).toContain(item.nutrition_grades);
			}
		}),
		60_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group A — Products
// ═══════════════════════════════════════════════════════════════════

describe("Open Food Facts Group A — products", () => {
	itWhen(
		"getProduct returns Nutella with a projected fields whitelist",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getProduct", {
				barcode: BARCODE,
				fields: "code,product_name,brands",
			})) as {
				data: { status?: number; product?: Record<string, unknown> };
			};
			// Found products: status 1, projected product object.
			expect(result.data.status).toBe(1);
			expect(result.data.product?.["code"]).toBe(BARCODE);
			expect(result.data.product?.["product_name"]).toBe("Nutella");
			expect(Object.keys(result.data.product!).length).toBeLessThanOrEqual(4);
		}),
		60_000,
	);

	itWhen(
		"getProduct returns HTTP 200 + status 0 for a missing barcode",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getProduct", {
				barcode: "0000000000000",
				fields: "code",
			})) as { data: { status?: number; status_verbose?: string } };
			expect(result.data.status).toBe(0);
			expect(result.data.status_verbose).toContain("no code or invalid");
		}),
		60_000,
	);

	itWhen(
		"getProductsByCodes returns all requested barcodes in one shot",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getProductsByCodes", {
				code: `${CODE_A},${CODE_B}`,
				fields: "code,product_name",
			})) as { data: { count?: number; products?: { code: string }[] } };
			expect(result.data.count).toBe(2);
			const codes = result.data.products?.map((p) => p.code) ?? [];
			expect(codes).toContain(CODE_A);
			expect(codes).toContain(CODE_B);
		}),
		60_000,
	);

	itWhen(
		"extractIngredientsOcr reads the Nutella label via Google Cloud Vision",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "extractIngredientsOcr", {
				code: BARCODE,
				id: "ingredients_fr",
				// No default in the recipe: re-OCR is opt-in (a Vision call on
				// the community's tab), so the test asks for it explicitly.
				process_image: 1,
			})) as { data: { ingredients_text_from_image?: string } };
			expect(typeof result.data.ingredients_text_from_image).toBe("string");
			expect(result.data.ingredients_text_from_image!.toLowerCase()).toContain(
				"noisettes",
			);
		}),
		60_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group B — Taxonomy & personal-search metadata
// ═══════════════════════════════════════════════════════════════════

describe("Open Food Facts Group B — taxonomy & metadata", () => {
	itWhen(
		"getTaxonomyEntries returns the requested node with its parents",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getTaxonomyEntries", {
				tagtype: "labels",
				tags: "en:organic",
				fields: "name,parents",
				lc: "en",
			})) as { data: Record<string, { name?: Record<string, string> }> };
			const node = result.data["en:organic"];
			expect(node?.name?.en).toBe("Organic");
		}),
		60_000,
	);

	itWhen(
		"listAttributeGroups returns the personal-search attribute groups",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listAttributeGroups", {
				lc: "en",
			})) as {
				data: {
					attributes?: { id?: string; name?: string; default?: string }[];
				}[];
			};
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data.length).toBeGreaterThan(0);
			const all = result.data.flatMap((g) => g.attributes ?? []);
			const ids = all.map((a) => a.id);
			expect(ids).toContain("nutriscore");
		}),
		60_000,
	);

	itWhen(
		"listPreferences returns the four preference weights",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listPreferences", {
				lc: "en",
			})) as { data: { id?: string; factor?: number }[] };
			expect(Array.isArray(result.data)).toBe(true);
			const ids = result.data.map((p) => p.id);
			expect(ids).toEqual([
				"not_important",
				"important",
				"very_important",
				"mandatory",
			]);
			// mandatory carries the highest factor.
			const mandatory = result.data.find((p) => p.id === "mandatory")!;
			expect(mandatory.factor).toBeGreaterThan(1);
		}),
		60_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group C — Legacy lookup helpers (cgi)
// ═══════════════════════════════════════════════════════════════════

describe("Open Food Facts Group C — legacy helpers", () => {
	itWhen(
		"suggestTags returns display strings for a tag type",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "suggestTags", {
				tagtype: "brands",
				term: "danon",
			})) as { data: string[] };
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data.length).toBeGreaterThan(0);
			expect(result.data.some((s) => s.toLowerCase().includes("danone"))).toBe(
				true,
			);
		}),
		60_000,
	);

	itWhen(
		"getNutrientsTree returns the nutrient hierarchy",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getNutrientsTree", {
				lc: "en",
			})) as { data: { nutrients?: { id: string; nutrients?: unknown[] }[] } };
			expect(Array.isArray(result.data.nutrients)).toBe(true);
			const ids = result.data.nutrients!.map((n) => n.id);
			expect(ids).toContain("energy-kcal");
		}),
		60_000,
	);
});
