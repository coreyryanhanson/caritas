/**
 * iNaturalist recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * This is the derived-id cursor live proof: the cursor
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
 * Covers all 37 ops: 8 observations reads, 8 identifications reads,
 * 3 taxa reads, 3 place reads, 4 project reads, 1 global search,
 * 3 user reads, 1 site-post read, 2 controlled-term reads, 4 geomodel
 * grid tiles.
 *
 * The service is a volunteer-run community resource: every live call is
 * paced (500 ms minimum gap) and pages are kept tiny (per_page ≤ 5 on
 * gather walks) per the etiquette. The ES-backed result window
 * (page × per_page ≤ 10000 → HTTP 403) is asserted as a live proof too.
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

const DIR = "inaturalist";
const DOMAIN = "api.inaturalist.org";

// ── Per-recipe fetch helpers: community-etiquette pacing ──

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const _fetch = createFetchOp(DOMAIN);

async function fetchOp(
	guidesDir: string,
	name: string,
	params: Record<string, unknown> = {},
) {
	await delay(500);
	return _fetch(guidesDir, name, params);
}

// Direct-paginate variant for gather walks, which call `paginate` itself
// to pass `{ gatherAll, gatherAllMax }` opts.
async function pacedPaginate(
	guidesDir: string,
	opName: string,
	params: Record<string, unknown>,
	opts: Record<string, unknown>,
) {
	const { paginate } = await import("pi-lean-host/core/helpers.js");
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	const { guide } = findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === opName),
	)!;
	const op = guide.operations.find((o) => o.name === opName)!;
	await delay(500);
	return paginate(
		guide.apiHost,
		op,
		params,
		guide,
		opts as Parameters<typeof paginate>[4],
	);
}

// ── Stable anchors (live-probed 2026-09-03) ─────────────────────────
const OBSERVATION = 123456; // returns full envelope; taxon_summary 200s
const IDENTIFICATION = 882702417; // from recent_taxa's first row
const TAXON = 6930; // Mallard (Anas platyrhynchos) — similar_species has 24 rows
const PLACE = 1; // United States
const PROJECT = 5; // Hawaii Sea Turtle Monitoring — 81 members (project 1 is empty)
const USER = 1; // kueda
const TILE = { zoom: 2, x: 1, y: 1 }; // mid-Atlantic tile — dense enough for grids

// ═══════════════════════════════════════════════════════════════════
// Parse (bare CI — deterministic, no network)
// ═══════════════════════════════════════════════════════════════════

describe("iNaturalist recipe parses", () => {
	it(
		"parses cleanly with guide-level page pagination + the derived-id cursor override",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/guide-catalog.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://api.inaturalist.org");
			expect(guide.auth.kind).toBe("none");
			expect(guide.operations).toHaveLength(37);

			// Guide-level page style: every list endpoint shares the
			// {total_results, page, per_page, results[]} envelope.
			expect(guide.pagination?.style).toBe("page");
			expect(guide.pagination?.itemsPath).toBe("results");
			expect(guide.pagination?.pageParam).toBe("page");
			expect(guide.pagination?.pageSizeParam).toBe("per_page");
			expect(guide.pagination?.totalCountPath).toBe("total_results");
			expect(guide.gatherAllMax).toBe(1000);

			// listObservations keeps the op-level cursor override — the
			// derived-id keyset walk — while everything else inherits page.
			const obs = guide.operations.find((o) => o.name === "listObservations")!;
			expect(obs.pagination?.style).toBe("cursor");
			expect(obs.pagination?.cursorPath).toBe("results[-1].id");
			expect(obs.pagination?.cursorParam).toBe("id_above");
			expect(obs.pagination?.itemsPath).toBe("results");
			expect(obs.pagination?.totalCountPath).toBe("total_results");
			expect(obs.pagination?.pageSize).toBe(30);
			// The sort defaults are declared params, sent on every page —
			// without them the API falls back to created_at/desc and the
			// keyset walk silently becomes a moving newest-items feed.
			expect(obs.params["order_by"]?.default).toBe("id");
			expect(obs.params["order"]?.default).toBe("asc");

			// Required flags on the ops the server 422s or empty-pages without.
			expect(
				guide.operations.find((o) => o.name === "search")!.params["q"]
					?.required,
			).toBe(true);
			expect(
				guide.operations.find((o) => o.name === "listSimilarSpecies")!.params[
					"taxon_id"
				]?.required,
			).toBe(true);
			expect(
				guide.operations.find((o) => o.name === "listTaxonControlledTerms")!
					.params["taxon_id"]?.required,
			).toBe(true);
			for (const name of [
				"autocompleteTaxa",
				"autocompletePlaces",
				"autocompleteProjects",
				"autocompleteUsers",
			]) {
				expect(
					guide.operations.find((o) => o.name === name)!.params["q"]?.required,
				).toBe(true);
			}

			// Single-entity reads wrap in the list envelope — they're restGet.
			for (const name of [
				"getObservation",
				"getTaxon",
				"getPlace",
				"getIdentification",
				"getUser",
				"getProject",
			]) {
				expect(guide.operations.find((o) => o.name === name)!.via).toBe(
					"restGet",
				);
			}
			// Shape-quirk endpoints are restGet: non-array results / bare array.
			for (const name of [
				"getObservationHistogram",
				"listNearbyPlaces",
				"listPosts",
			]) {
				expect(guide.operations.find((o) => o.name === name)!.via).toBe(
					"restGet",
				);
			}
		}),
	);
});

// ═══════════════════════════════════════════════════════════════════
// Live (HOST_INTEGRATION=1 — no key, paced)
// ═══════════════════════════════════════════════════════════════════

// ── Group A — Observations ──

describe("iNaturalist live: observations", () => {
	itWhen(
		"listObservations fetches a first page with numeric server total",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await pacedPaginate(
				guidesDir,
				"listObservations",
				{ per_page: 2, order_by: "id", order: "asc" },
				{},
			)) as { items: { id: number }[]; serverTotal?: number };
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBe(2);
			for (const item of result.items) {
				expect(typeof item.id).toBe("number");
			}
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"listObservations gatherAll walks past page 1 via the last-item id echo (derived-id cursor proof)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await pacedPaginate(
				guidesDir,
				"listObservations",
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
			expect(result.pages).toBe(2);
			expect(result.totalFetched).toBe(10);
			expect(result.ceilingHit).toBe(true);

			const ids = result.items.map((it) => it.id);
			for (let i = 1; i < ids.length; i++) {
				expect(ids[i]!).toBeGreaterThan(ids[i - 1]!);
			}
			expect(new Set(ids).size).toBe(ids.length);

			expect(result.urls[0]).not.toContain("id_above=");
			expect(result.urls[1]).toContain(`id_above=${ids[4]}`);
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(10);
		}),
		60_000,
	);

	itWhen(
		"getObservation wraps the single object in the list envelope",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data } = (await fetchOp(guidesDir, "getObservation", {
				id: OBSERVATION,
			})) as {
				data: { total_results: number; results: Record<string, unknown>[] };
			};
			const body = data;
			expect(body.total_results).toBe(1);
			expect(body.results[0]!.id).toBe(OBSERVATION);
			// Heavy payload: full taxon + user objects embedded.
			expect(body.results[0]!.taxon).toBeTruthy();
			expect(body.results[0]!.user).toBeTruthy();
		}),
		30_000,
	);

	itWhen(
		"getObservationTaxonSummary returns the taxon context",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(
				guidesDir,
				"getObservationTaxonSummary",
				{
					id: OBSERVATION,
				},
			)) as { data: Record<string, unknown> };
			expect(body).toHaveProperty("wikipedia_summary");
			expect("conservation_status" in body).toBe(true);
		}),
		30_000,
	);

	itWhen(
		"getObservationHistogram returns a bucket-key object (non-array results)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(
				guidesDir,
				"getObservationHistogram",
				{
					d1: "2024-01-01",
					d2: "2024-01-31",
				},
			)) as { data: { results: Record<string, unknown> } };
			expect(typeof body.results).toBe("object");
			expect(body.results).not.toBeNull();
			expect(Array.isArray(body.results)).toBe(false);
			expect(Object.keys(body.results)).toContain("month_of_year");
		}),
		30_000,
	);

	itWhen(
		"listObservationSpeciesCounts returns ranked {count, taxon} rows",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listObservationSpeciesCounts", {
				per_page: 5,
			})) as {
				items: { count: number; taxon: { id: number } }[];
				serverTotal?: number;
			};
			expect(result.items.length).toBe(5);
			for (const row of result.items) {
				expect(typeof row.count).toBe("number");
				expect(typeof row.taxon.id).toBe("number");
			}
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listObservationIdentifiers returns identifier leaderboard rows",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listObservationIdentifiers", {
				per_page: 3,
			})) as { items: { user_id: number; count: number }[] };
			expect(result.items.length).toBe(3);
			expect(result.items[0]!).toHaveProperty("count");
			expect(result.items[0]!).toHaveProperty("user");
		}),
		30_000,
	);

	itWhen(
		"listObservationObservers returns observer leaderboard rows",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listObservationObservers", {
				per_page: 3,
			})) as { items: { observation_count: number }[] };
			expect(result.items.length).toBe(3);
			expect(result.items[0]!).toHaveProperty("species_count");
		}),
		30_000,
	);

	itWhen(
		"listPopularFieldValues returns annotation usage rows",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listPopularFieldValues",
				{},
			)) as {
				items: Record<string, unknown>[];
			};
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items[0]!).toHaveProperty("controlled_attribute");
		}),
		30_000,
	);
});

// ── Group B — Identifications ──

describe("iNaturalist live: identifications", () => {
	itWhen(
		"listIdentifications fetches a page under the guide-level page style",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listIdentifications", {
				per_page: 2,
			})) as {
				items: { id: number }[];
				pages: number;
				serverTotal?: number;
			};
			expect(result.items.length).toBe(2);
			expect(result.pages).toBe(1);
			expect(result.serverTotal!).toBeGreaterThan(700_000_000);
		}),
		30_000,
	);

	itWhen(
		"getIdentification wraps the object under results[0]",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(guidesDir, "getIdentification", {
				id: IDENTIFICATION,
			})) as { data: { total_results: number; results: { id: number }[] } };
			expect(body.total_results).toBe(1);
			expect(body.results[0]!.id).toBe(IDENTIFICATION);
		}),
		30_000,
	);

	itWhen(
		"listIdentificationCategories returns the four categories",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listIdentificationCategories",
				{},
			)) as { items: { category: string }[] };
			expect(result.items.length).toBe(4);
			const names = result.items.map((r) => r.category);
			expect(names).toContain("leading");
			expect(names).toContain("supporting");
		}),
		30_000,
	);

	itWhen(
		"listIdentificationIdentifiers returns identifier rows",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listIdentificationIdentifiers",
				{
					per_page: 3,
				},
			)) as { items: { count: number }[] };
			expect(result.items.length).toBe(3);
			expect(result.items[0]!).toHaveProperty("user");
		}),
		30_000,
	);

	itWhen(
		"listIdentificationObservers returns observer rows",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listIdentificationObservers", {
				per_page: 3,
			})) as { items: { count: number }[] };
			expect(result.items.length).toBe(3);
		}),
		30_000,
	);

	itWhen(
		"listRecentTaxa returns rows with embedded identification objects",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listRecentTaxa", {
				per_page: 2,
			})) as {
				items: { taxon: { id: number }; identification: { id: number } }[];
			};
			expect(result.items.length).toBe(2);
			for (const row of result.items) {
				expect(typeof row.taxon.id).toBe("number");
				expect(row.identification).toBeTruthy();
			}
		}),
		30_000,
	);

	itWhen(
		"listSimilarSpecies requires taxon_id and returns confusion species",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listSimilarSpecies", {
				taxon_id: TAXON,
			})) as { items: { taxon: { id: number } }[]; serverTotal?: number };
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items[0]!.taxon).toBeTruthy();
			expect(result.serverTotal).toBe(24);
		}),
		30_000,
	);

	itWhen(
		"listIdentificationSpeciesCounts returns {count, taxon} rows",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listIdentificationSpeciesCounts",
				{
					per_page: 3,
				},
			)) as { items: { count: number; taxon: { id: number } }[] };
			expect(result.items.length).toBe(3);
			expect(typeof result.items[0]!.count).toBe("number");
		}),
		30_000,
	);
});

// ── Group C — Taxa ──

describe("iNaturalist live: taxa", () => {
	itWhen(
		"listTaxa fetches a page with a server total in the millions",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listTaxa", {
				per_page: 3,
			})) as { items: { id: number; rank: string }[]; serverTotal?: number };
			expect(result.items.length).toBe(3);
			expect(result.serverTotal!).toBeGreaterThan(1_000_000);
			for (const t of result.items) {
				expect(typeof t.id).toBe("number");
				expect(typeof t.rank).toBe("string");
			}
		}),
		30_000,
	);

	itWhen(
		"getTaxon wraps the object under results[0]",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(guidesDir, "getTaxon", {
				id: TAXON,
			})) as {
				data: {
					total_results: number;
					results: { id: number; name: string }[];
				};
			};
			expect(body.results[0]!.id).toBe(TAXON);
			expect(body.results[0]!.name).toBe("Anas platyrhynchos");
		}),
		30_000,
	);

	itWhen(
		"autocompleteTaxa resolves a name prefix",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "autocompleteTaxa", {
				q: "robin",
			})) as { items: { name: string }[] };
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items.some((t) => t.name === "Turdus migratorius")).toBe(
				true,
			);
		}),
		30_000,
	);
});

// ── Group D — Places ──

describe("iNaturalist live: places", () => {
	itWhen(
		"autocompletePlaces resolves a place-name prefix",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "autocompletePlaces", {
				q: "cali",
			})) as { items: { name: string }[] };
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items.some((p) => p.name === "California")).toBe(true);
		}),
		30_000,
	);

	itWhen(
		"listNearbyPlaces returns the {standard, community} object shape",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(guidesDir, "listNearbyPlaces", {
				nelat: 45,
				nelng: -88,
				swlat: 43,
				swlng: -92,
			})) as {
				data: { results: { standard: unknown[]; community: unknown[] } };
			};
			expect(Array.isArray(body.results.standard)).toBe(true);
			expect(Array.isArray(body.results.community)).toBe(true);
		}),
		30_000,
	);

	itWhen(
		"getPlace wraps the object under results[0]",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(guidesDir, "getPlace", {
				id: PLACE,
			})) as { data: { results: { id: number; name: string }[] } };
			expect(body.results[0]!.id).toBe(PLACE);
			expect(body.results[0]!.name).toBe("United States");
		}),
		30_000,
	);
});

// ── Group E — Projects ──

describe("iNaturalist live: projects", () => {
	itWhen(
		"listProjects fetches a page with the capped server total",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listProjects", {
				per_page: 2,
			})) as { items: { id: number; title: string }[]; serverTotal?: number };
			expect(result.items.length).toBe(2);
			// total_results is capped at 10000 on this ES-backed endpoint.
			expect(result.serverTotal).toBe(10000);
		}),
		30_000,
	);

	itWhen(
		"autocompleteProjects resolves a title prefix",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "autocompleteProjects", {
				q: "birds",
			})) as { items: { title: string }[] };
			expect(result.items.length).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"getProject returns the Hawaii Sea Turtle Monitoring project",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(guidesDir, "getProject", {
				id: PROJECT,
			})) as {
				data: {
					total_results: number;
					results: { id: number; title: string }[];
				};
			};
			expect(body.results[0]!.id).toBe(PROJECT);
			expect(body.results[0]!.title).toContain("Hawaii");
		}),
		30_000,
	);

	itWhen(
		"listProjectMembers returns membership rows for the anchored project",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listProjectMembers", {
				id: PROJECT,
				per_page: 3,
			})) as {
				items: { project_id: number; user_id: number }[];
				serverTotal?: number;
			};
			expect(result.items.length).toBe(3);
			for (const row of result.items) {
				expect(row.project_id).toBe(PROJECT);
			}
			expect(result.serverTotal).toBe(81);
		}),
		30_000,
	);
});

// ── Group F — Global search ──

describe("iNaturalist live: search", () => {
	itWhen(
		"search returns {score, type, record} rows with the capped total",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "search", {
				q: "robin",
			})) as {
				items: { score: number; type: string; record: unknown }[];
				serverTotal?: number;
			};
			expect(result.items.length).toBeGreaterThan(0);
			for (const row of result.items) {
				expect(typeof row.score).toBe("number");
				expect(typeof row.type).toBe("string");
				expect(row.record).toBeTruthy();
			}
			// total_results is capped at 10000 on this endpoint.
			expect(result.serverTotal).toBe(10000);
		}),
		30_000,
	);
});

// ── Group G — Users ──

describe("iNaturalist live: users", () => {
	itWhen(
		"autocompleteUsers resolves a login prefix",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "autocompleteUsers", {
				q: "kueda",
				per_page: 5,
			})) as { items: { login: string }[] };
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items.some((u) => u.login === "kueda")).toBe(true);
		}),
		30_000,
	);

	itWhen(
		"getUser wraps the profile under results[0]",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(guidesDir, "getUser", {
				id: USER,
			})) as { data: { results: { id: number; login: string }[] } };
			expect(body.results[0]!.id).toBe(USER);
			expect(body.results[0]!.login).toBe("kueda");
		}),
		30_000,
	);

	itWhen(
		"listUserProjects returns project rows for the anchored user",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listUserProjects", {
				id: USER,
				per_page: 3,
			})) as { items: Record<string, unknown>[]; serverTotal?: number };
			expect(result.items.length).toBe(3);
			expect(result.serverTotal!).toBeGreaterThan(100);
		}),
		30_000,
	);
});

// ── Group H — Community content ──

describe("iNaturalist live: posts", () => {
	itWhen(
		"listPosts returns a bare array (no envelope) of site posts",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(guidesDir, "listPosts", {})) as {
				data: { id: number; title: string; published_at?: string }[];
			};
			expect(Array.isArray(body)).toBe(true);
			expect(body.length).toBeGreaterThan(0);
			expect(body[0]!).toHaveProperty("published_at");
		}),
		30_000,
	);
});

// ── Group I — Controlled terms ──

describe("iNaturalist live: controlled terms", () => {
	itWhen(
		"listControlledTerms returns the annotation vocabulary",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listControlledTerms", {})) as {
				items: { label: string; values: unknown[] }[];
				serverTotal?: number;
			};
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.serverTotal).toBe(7);
			expect(result.items[0]!).toHaveProperty("values");
		}),
		30_000,
	);

	itWhen(
		"listTaxonControlledTerms requires taxon_id and returns per-taxon terms",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listTaxonControlledTerms", {
				taxon_id: TAXON,
			})) as { items: unknown[] };
			// Often empty for a given taxon — the assertion is the envelope shape.
			expect(Array.isArray(result.items)).toBe(true);
		}),
		30_000,
	);
});

// ── Group J — Geomodel tiles ──

describe("iNaturalist live: grid tiles", () => {
	itWhen(
		"getObservationGrid returns an ASCII intensity grid",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(
				guidesDir,
				"getObservationGrid",
				TILE,
			)) as {
				data: { grid: string[] };
			};
			expect(Array.isArray(body.grid)).toBe(true);
			expect(body.grid.length).toBeGreaterThan(0);
			expect(typeof body.grid[0]).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"getHeatmapGrid returns an ASCII intensity grid",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(
				guidesDir,
				"getHeatmapGrid",
				TILE,
			)) as {
				data: { grid: string[] };
			};
			expect(body.grid.length).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"getColoredHeatmapGrid returns an ASCII intensity grid",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(
				guidesDir,
				"getColoredHeatmapGrid",
				TILE,
			)) as {
				data: { grid: string[] };
			};
			expect(body.grid.length).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"getPointsGrid returns an ASCII intensity grid",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { data: body } = (await fetchOp(
				guidesDir,
				"getPointsGrid",
				TILE,
			)) as {
				data: { grid: string[] };
			};
			expect(body.grid.length).toBeGreaterThan(0);
		}),
		30_000,
	);
});

// ── Page-style pagination proof + ES result-window proof ──

describe("iNaturalist live: pagination proofs", () => {
	itWhen(
		"listTaxa gatherAll walks past page 1 under the guide-level page style",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await pacedPaginate(
				guidesDir,
				"listTaxa",
				{ per_page: 5 },
				{ gatherAll: true, gatherAllMax: 10 },
			)) as {
				items: { id: number }[];
				totalFetched: number;
				pages: number;
				urls: string[];
				ceilingHit: boolean;
			};
			expect(result.pages).toBe(2);
			expect(result.totalFetched).toBe(10);
			expect(result.ceilingHit).toBe(true);
			// Page 2 request advanced the page param (page style).
			expect(result.urls[0]).toContain("page=1");
			expect(result.urls[1]).toContain("page=2");
			// No overlap: page 2 continues after page 1's rows (same sort).
			const firstPageIds = result.items.slice(0, 5).map((t) => t.id);
			const secondPageIds = result.items.slice(5).map((t) => t.id);
			expect(secondPageIds.some((id) => firstPageIds.includes(id))).toBe(false);
		}),
		60_000,
	);

	itWhen(
		"the ES result window (page x per_page > 10000) fails loudly with the documented 403",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			await expect(
				fetchOp(guidesDir, "listTaxa", { page: 101, per_page: 100 }),
			).rejects.toThrow(/Result window is too large/);
		}),
		30_000,
	);
});
