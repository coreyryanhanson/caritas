/**
 * DNB (services.dnb.de) recipe validity tests — endpoint coverage + live fetch
 * sanity.
 *
 * Parses the recipe, executes every operation against the live endpoint, and
 * asserts the response has the expected shape (200 + non-empty body /
 * expected `itemsPath` for `paginate` ops).
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1.
 * Co-located with the guide it tests.
 *
 * The `resumptionToken` ops (oaiListRecords / oaiListIdentifiers) harvest the
 * whole DNB catalogue by default; a `/oai/repository` first request with no
 * window 413s (DNB caps a response at 100k records). Tests bound them with a
 * narrow `from`/`until` window so they return a handful of pages. Set spec is
 * not used (the only top-level set is `dnb`, which is the whole catalogue).
 */

import { describe, expect } from "vitest";
import {
	createFetchOp,
	itWhen,
	withTempDirs,
} from "../_shared/test-harness.js";

const DIR = "deutsche-nationalbibliothek";
const DOMAIN = "dnb.de";

// ── Per-recipe fetch helper (bootstrap shared via createFetchOp; no wrapper) ──

const fetchOp = createFetchOp(DOMAIN);

// Stable live params for DNB.
const SRU_QUERY = "Leipzig"; // broad bare term — returns thousands of hits
const OAI_FROM = "2026-08-05T00:00:00Z"; // narrow window → small paginated batch
const OAI_UNTIL = "2026-08-05T00:05:00Z";
// A real, stable GND authority id (Goethe) for the single-record OAI lookup.
const OAI_IDENTIFIER = "oai:dnb.de/authorities/118540238";

function expectXmlItems(items: unknown[]): void {
	expect(Array.isArray(items)).toBe(true);
	expect(items.length).toBeGreaterThan(0);
}

// ═══════════════════════════════════════════════════════════════════
// Baseline
// ═══════════════════════════════════════════════════════════════════

describe("DNB live integration smoke", () => {
	itWhen(
		"parses and loads the recipe with all 10 ops",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/guide-catalog.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(
				"deutsche-nationalbibliothek",
			);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides["deutsche-nationalbibliothek"]!;
			expect(guide.apiHost).toBe("https://services.dnb.de");
			expect(guide.auth.kind).toBe("none");
			expect(guide.operations.length).toBe(10);
		}),
		20_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// SRU catalogue searches (offset-limit paginate, XML)
// ═══════════════════════════════════════════════════════════════════

describe("DNB SRU catalogue searches", () => {
	itWhen(
		"searchZdb searches the ZDB serials catalogue via paginate",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "searchZdb", {
				query: "Wasser",
			})) as { items: unknown[] };
			expectXmlItems(result.items);
		}),
		20_000,
	);

	itWhen(
		"searchDnb searches the DNB main catalogue via paginate (indexed query)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "searchDnb", {
				query: "SW=Goethe",
			})) as { items: unknown[] };
			expectXmlItems(result.items);
		}),
		20_000,
	);

	itWhen(
		"searchDma searches the German Music Archive via paginate",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "searchDma", {
				query: SRU_QUERY,
			})) as { items: unknown[] };
			expectXmlItems(result.items);
		}),
		20_000,
	);

	itWhen(
		"searchAuthorities searches the GND authority file via paginate (indexed query)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "searchAuthorities", {
				query: "WOE=Goethe",
			})) as { items: unknown[] };
			expectXmlItems(result.items);
		}),
		20_000,
	);

	itWhen(
		"searchZdb with an indexed query throws the 200-OK SRU diagnostic",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// C1 (design doc Workstream C): an indexed query ZDB rejects
			// (info:srw/diagnostic/1/16) returns HTTP 200 with a <diagnostics>
			// element and no <records>. Since errorPath
			// (searchRetrieveResponse.diagnostics.diagnostic) landed, the
			// envelope check fires before the itemsPath exhaustion break and
			// the op throws a structured HelperError naming the diagnostic —
			// no longer indistinguishable from a genuine zero-results query.
			await expect(
				fetchOp(guidesDir, "searchZdb", { query: "Titel=Wasser" }),
			).rejects.toThrow(/Unsupported index/);
			await expect(
				fetchOp(guidesDir, "searchZdb", { query: "Titel=Wasser" }),
			).rejects.toThrow(/info:srw\/diagnostic\/1\/16/);
		}),
		20_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// OAI-PMH single-request verbs (restGet, XML)
// ═══════════════════════════════════════════════════════════════════

describe("DNB OAI-PMH single verbs", () => {
	itWhen(
		"oaiIdentify returns repository metadata",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "oaiIdentify")) as {
				data: { "OAI-PMH"?: { Identify?: { repositoryName?: string } } };
			};
			expect(result.data).toBeTruthy();
			expect(typeof result.data["OAI-PMH"]?.Identify?.repositoryName).toBe(
				"string",
			);
		}),
		20_000,
	);

	itWhen(
		"oaiListSets enumerates available sets",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "oaiListSets")) as {
				data: { "OAI-PMH"?: { ListSets?: { set?: unknown } } };
			};
			expect(result.data).toBeTruthy();
			expect(result.data["OAI-PMH"]?.ListSets).toBeTruthy();
		}),
		20_000,
	);

	itWhen(
		"oaiListMetadataFormats lists available metadata formats",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "oaiListMetadataFormats")) as {
				data: {
					"OAI-PMH"?: { ListMetadataFormats?: { metadataFormat?: unknown } };
				};
			};
			expect(result.data).toBeTruthy();
			expect(result.data["OAI-PMH"]?.ListMetadataFormats).toBeTruthy();
		}),
		20_000,
	);

	itWhen(
		"oaiGetRecord returns a single record by identifier",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "oaiGetRecord", {
				identifier: OAI_IDENTIFIER,
				metadataPrefix: "MARC21-xml",
			})) as { data: { "OAI-PMH"?: { GetRecord?: { record?: unknown } } } };
			expect(result.data).toBeTruthy();
			expect(result.data["OAI-PMH"]?.GetRecord?.record).toBeTruthy();
		}),
		20_000,
	);

	itWhen(
		"oaiGetRecord with an unknown identifier throws the OAI-PMH error element",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			// idDoesNotExist rides the same 200 envelope as the SRU class:
			// <OAI-PMH><error code="idDoesNotExist">…</error></OAI-PMH>.
			// errorPath: OAI-PMH.error makes it a structured failure naming
			// the code instead of data without a GetRecord element.
			await expect(
				fetchOp(guidesDir, "oaiGetRecord", {
					identifier: "oai:dnb.de/authorities/BOGUS000000",
					metadataPrefix: "MARC21-xml",
				}),
			).rejects.toThrow(/idDoesNotExist/);
		}),
		20_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// OAI-PMH resumptionToken harvests (paginate; bounded to a small window)
// These are the pre-existing ops; reachability is asserted (first page).
// ═══════════════════════════════════════════════════════════════════

describe("DNB OAI-PMH resumptionToken harvests", () => {
	itWhen(
		"oaiListRecords harvests a bounded window via resumptionToken",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "oaiListRecords", {
				verb: "ListRecords",
				metadataPrefix: "oai_dc",
				from: OAI_FROM,
				until: OAI_UNTIL,
			})) as { items: unknown[] };
			expect(Array.isArray(result.items)).toBe(true);
		}),
		30_000,
	);

	itWhen(
		"oaiListIdentifiers harvests identifiers over a bounded window via resumptionToken",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "oaiListIdentifiers", {
				verb: "ListIdentifiers",
				metadataPrefix: "oai_dc",
				from: OAI_FROM,
				until: OAI_UNTIL,
			})) as { items: unknown[] };
			expect(Array.isArray(result.items)).toBe(true);
		}),
		30_000,
	);
});
