/**
 * iNaturalist recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * This is the derived-id cursor proof recipe (P2-1 live proof): the cursor
 * value is the LAST ITEM's numeric `id` — resolved via the negative-index
 * path `results[-1].id` — fed back as the `id_above` query param. The
 * gatherAll walk asserts the cursor branch coerces the numeric id (~3.9×10⁸,
 * unquoted JSON integer) to the wire param, advances past page 1
 * non-overlapping, and the `total_results` count survives as `serverTotal`.
 * Empty-page termination is pinned by the mocked axis-units test in
 * pi-lean-host (`results[-1]` on the empty final page is a clean miss); the
 * live walk here is bounded by gatherAllMax before the end marker would
 * appear.
 *
 * Parse assertions run in bare CI (no network). Live tests are skipped
 * unless HOST_INTEGRATION=1. No key, no rate wall — but the service is a
 * volunteer-run community resource, so every live call is paced (500 ms
 * minimum gap) and pages are kept tiny (per_page ≤ 5) per the etiquette.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "api.inaturalist.org";
const DIR = "inaturalist";
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Per-recipe fetch helper: community-etiquette pacing ──

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastLiveAt = 0;

async function throttleLive(): Promise<void> {
	const MIN_GAP = 500; // volunteer-run community service — pace generously
	const now = Date.now();
	const wait = Math.max(0, MIN_GAP - (now - lastLiveAt));
	if (wait > 0) await delay(wait);
	lastLiveAt = Date.now();
}

async function runPaginate(
	guidesDir: string,
	params: Record<string, unknown>,
	opts: Record<string, unknown> = {},
) {
	const { paginate } = await import("pi-lean-host/core/helpers.js");
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	const { guide } = findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === "listObservations"),
	)!;
	const op = guide.operations.find((o) => o.name === "listObservations")!;
	await throttleLive();
	return paginate(
		guide.apiHost,
		op,
		params,
		guide,
		opts as Parameters<typeof paginate>[4],
	);
}

// ═══════════════════════════════════════════════════════════════════
// Parse (bare CI — deterministic, no network)
// ═══════════════════════════════════════════════════════════════════

describe("iNaturalist recipe parses", () => {
	it(
		"parses cleanly with the negative-index derived-id cursor block",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://api.inaturalist.org");
			expect(guide.auth.kind).toBe("none");
			expect(guide.operations.map((o) => o.name)).toEqual(["listObservations"]);

			const pag = guide.operations[0]!.pagination ?? guide.pagination;
			expect(pag?.style).toBe("cursor");
			expect(pag?.cursorPath).toBe("results[-1].id");
			expect(pag?.cursorParam).toBe("id_above");
			expect(pag?.itemsPath).toBe("results");
			expect(pag?.totalCountPath).toBe("total_results");
			expect(pag?.pageSizeParam).toBe("per_page");
			expect(pag?.pageSize).toBe(30);
			// The sort defaults are declared params, sent on every page —
			// without them the API falls back to created_at/desc and the
			// keyset walk silently becomes a moving newest-items feed.
			expect(guide.operations[0]!.params["order_by"]?.default).toBe("id");
			expect(guide.operations[0]!.params["order"]?.default).toBe("asc");
		}),
	);
});

// ═══════════════════════════════════════════════════════════════════
// Live (HOST_INTEGRATION=1 — no key, paced)
// ═══════════════════════════════════════════════════════════════════

describe("iNaturalist live integration smoke", () => {
	itWhen(
		"listObservations fetches a first page with numeric server total",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await runPaginate(guidesDir, {
				per_page: 2,
				order_by: "id",
				order: "asc",
			})) as { items: { id: number }[]; serverTotal?: number };
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBe(2);
			// Each item carries its numeric observation id — the cursor source.
			for (const item of result.items) {
				expect(typeof item.id).toBe("number");
			}
			// total_results resolves the server-wide count (~3.9×10⁸ and
			// climbing — a JSON integer far past anything a token string).
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"listObservations gatherAll walks past page 1 via the last-item id echo (derived-id cursor proof)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await runPaginate(
				guidesDir,
				{ per_page: 5, order_by: "id", order: "asc" },
				{ gatherAll: true, gatherAllMax: 10 },
			)) as {
				items: { id: number }[];
				totalFetched: number;
				pages: number;
				urls: string[];
				serverTotal?: number;
				ceilingHit: boolean;
			};
			// per_page=5, ceiling 10 → 2 pages walked.
			expect(result.pages).toBe(2);
			expect(result.totalFetched).toBe(10);
			expect(result.ceilingHit).toBe(true);

			const ids = result.items.map((it) => it.id);
			// Non-overlapping keyset walk: ids strictly increase page over
			// page (asc + id_above) — no row read twice, none skipped.
			for (let i = 1; i < ids.length; i++) {
				expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
			}
			expect(new Set(ids).size).toBe(ids.length);

			// Page 2 was seeded by the LAST ITEM of page 1 (results[-1].id),
			// coerced to the wire param — pre-negative-index this path was
			// malformed and the walk silently stopped after page 1.
			expect(result.urls[0]).not.toContain("id_above=");
			expect(result.urls[1]).toContain(`id_above=${ids[4]}`);
			// The numeric total survived the walk.
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(10);
		}),
		60_000,
	);
});
