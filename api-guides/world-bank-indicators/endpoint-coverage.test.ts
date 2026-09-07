/**
 * World Bank Indicators recipe validity tests — endpoint coverage + live
 * fetch sanity.
 *
 * Tests the World Bank Indicators API v2: parses the recipe, executes the
 * defined operations against the live endpoint, and asserts the response
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
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://api.worldbank.org");
			expect(guide.auth.kind).toBe("none");
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
});
