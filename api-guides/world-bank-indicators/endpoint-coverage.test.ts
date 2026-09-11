/**
 * World Bank Indicators recipe validity tests — endpoint coverage + live
 * fetch sanity.
 *
 * Tests the World Bank Indicators API v2: parses the recipe, executes every
 * defined operation against the live endpoint, and asserts the response
 * has the expected shape — including the HTTP 200 error envelope
 * (`errorPath: 0.message`), the reason this recipe exists.
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1.
 * Co-located with the guide it tests.
 */

import { describe, expect } from "vitest";
import {
	createFetchOp,
	itWhen,
	withTempDirs,
} from "../_shared/test-harness.js";

const DIR = "world-bank-indicators";

// ── Per-recipe fetch helper (bootstrap shared via createFetchOp; no wrapper) ──

const fetchOp = createFetchOp("worldbank.org");

// ═══════════════════════════════════════════════════════════════════
// Baseline: parse, sources first page
// ═══════════════════════════════════════════════════════════════════

describe("World Bank Indicators live integration", () => {
	itWhen(
		"parses and loads the World Bank Indicators recipe from a temp user dir",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/guide-catalog.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://api.worldbank.org");
			expect(guide.auth.kind).toBe("none");
			// Full v2 surface: 8 catalog lists + 2 gets + the data call.
			expect(guide.operations.length).toBe(11);
			for (const op of guide.operations) {
				expect(op.errorPath).toBe("0.message");
			}
		}),
	);

	itWhen(
		"sources fetches the first page of the database catalog",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "sources")) as {
				items: Array<{ id: string; code: string; name: string }>;
			};
			// `paginate` returns accumulated items (page style, single page by
			// default); itemsPath "1" targets the records element of the
			// [meta, records] envelope.
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);
			const first = result.items[0]!;
			expect(typeof first.id).toBe("string");
			expect(typeof first.name).toBe("string");
		}),
		20_000,
	);

	itWhen(
		"sources resolves the meta total via totalCountPath 0.total",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "sources", {
				per_page: 10,
			})) as { items: unknown[]; serverTotal?: number };
			// Single page by default (executor contract); serverTotal proves
			// totalCountPath 0.total resolves the string meta total. The full
			// multi-page gatherAll walk (9 pages / 71 items, clean termination
			// on 0.total) was verified live via probe-op --gatherAll.
			expect(result.items.length).toBe(10);
			// 71 at verification time (2026-09-07) but the catalog drifts by
			// design — assert resolution, not a frozen count.
			expect(result.serverTotal).toBeGreaterThan(10);
		}),
		20_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Catalog lists: countries, indicators, topics, regions, incomeLevels,
// lendingTypes, languages
// ═══════════════════════════════════════════════════════════════════

describe("World Bank Indicators catalog lists", () => {
	itWhen(
		"countries lists economies with region/incomeLevel/lendingType tables",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "countries", {
				per_page: 5,
			})) as { items: Array<{ id: string; region: { id: string } }> };
			expect(result.items.length).toBe(5);
			expect(result.items[0]!.id).toMatch(/^[A-Z]{3}$/);
			expect(typeof result.items[0]!.region.id).toBe("string");
		}),
		20_000,
	);

	itWhen(
		"indicators lists the catalog and honors the source filter",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "indicators", {
				per_page: 3,
				source: "2",
			})) as {
				items: Array<{ id: string; source: { id: string } }>;
			};
			expect(result.items.length).toBe(3);
			expect(result.items.every((i) => i.source.id === "2")).toBe(true);
		}),
		20_000,
	);

	itWhen(
		"topics lists catalog topics",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "topics")) as {
				items: Array<{ id: string; value: string }>;
			};
			expect(result.items.length).toBeGreaterThan(0);
			expect(typeof result.items[0]!.value).toBe("string");
		}),
		20_000,
	);

	itWhen(
		"regions / incomeLevels / lendingTypes / languages list their slices",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const regions = (await fetchOp(guidesDir, "regions")) as {
				items: Array<{ code: string; name: string }>;
			};
			expect(regions.items.length).toBeGreaterThan(0);
			expect(typeof regions.items[0]!.code).toBe("string");

			const incomeLevels = (await fetchOp(guidesDir, "incomeLevels")) as {
				items: Array<{ id: string; value: string }>;
			};
			expect(incomeLevels.items.length).toBe(7);

			const lendingTypes = (await fetchOp(guidesDir, "lendingTypes")) as {
				items: Array<{ id: string }>;
			};
			expect(lendingTypes.items.length).toBe(4);

			const languages = (await fetchOp(guidesDir, "languages")) as {
				items: Array<{ code: string; name: string }>;
			};
			expect(languages.items.length).toBeGreaterThan(0);
			expect(languages.items.some((l) => l.code === "en")).toBe(true);
		}),
		20_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Get ops + the data call
// ═══════════════════════════════════════════════════════════════════

describe("World Bank Indicators gets + data", () => {
	itWhen(
		"country resolves multiple codes through the {codes} path param",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "country", {
				codes: "br;no",
			})) as {
				items: Array<{ id: string; name: string }>;
				serverTotal?: number;
			};
			expect(result.items.map((c) => c.id)).toEqual(["BRA", "NOR"]);
			expect(result.serverTotal).toBe(2);
		}),
		20_000,
	);

	itWhen(
		"indicator fetches one indicator's metadata by code",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "indicator", {
				code: "NY.GDP.MKTP.CD",
			})) as { items: Array<{ id: string; name: string }> };
			expect(result.items).toHaveLength(1);
			expect(result.items[0]!.id).toBe("NY.GDP.MKTP.CD");
		}),
		20_000,
	);

	itWhen(
		"indicatorData returns per-observation records over a date range",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "indicatorData", {
				countries: "br",
				indicator: "NY.GDP.MKTP.CD",
				date: "2020:2022",
			})) as {
				items: Array<{
					date: string;
					value: number | null;
					countryiso3code: string;
				}>;
				serverTotal?: number;
			};
			// 3 annual observations (2020–2022); newest first on the wire.
			expect(result.serverTotal).toBe(3);
			expect(result.items.map((i) => i.date)).toEqual(["2022", "2021", "2020"]);
			expect(result.items[0]!.countryiso3code).toBe("BRA");
			expect(typeof result.items[0]!.value).toBe("number");
		}),
		20_000,
	);

	itWhen(
		"indicatorData honors mrv (most recent values)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "indicatorData", {
				countries: "br;no",
				indicator: "NY.GDP.MKTP.CD",
				mrv: 2,
			})) as { items: Array<{ date: string }>; serverTotal?: number };
			// 2 countries × 2 most recent years.
			expect(result.serverTotal).toBe(4);
			expect(result.items.length).toBe(4);
		}),
		20_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Error envelope: HTTP 200 with a body error
// ═══════════════════════════════════════════════════════════════════

describe("World Bank Indicators error envelope", () => {
	itWhen(
		"an invalid parameter throws the 200 error envelope as a structured error",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// page=-1 → HTTP 200 with [{"message":[{"id":"120","key":
			// "Invalid value","value":"…"}]}] — an envelope that MISSES
			// itemsPath "1" entirely (single-element array). errorPath fires
			// before the exhaustion breaks, so this throws instead of
			// silently reading as items: []. (A non-numeric per_page/page is
			// sanitized to the fallback by the executor before the request,
			// so a negative value is the reachable bad-parameter trigger on
			// this endpoint.) One live call; assert code and message off the
			// same error.
			const error = await fetchOp(guidesDir, "sources", {
				page: -1,
			}).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toMatch(/Invalid value/);
			expect((error as Error).message).toMatch(/120/);
		}),
		20_000,
	);

	itWhen(
		"indicatorData with an unknown country code throws the same envelope",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const error = await fetchOp(guidesDir, "indicatorData", {
				countries: "bogus",
				indicator: "NY.GDP.MKTP.CD",
			}).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(Error);
			expect((error as Error).message).toMatch(/Invalid value/);
			expect((error as Error).message).toMatch(/error envelope/);
		}),
		20_000,
	);
});
