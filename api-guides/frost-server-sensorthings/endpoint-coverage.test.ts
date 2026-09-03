/**
 * FROST-Server (SensorThings) recipe validity tests — endpoint coverage +
 * live fetch sanity.
 *
 * This is the dotted-key pagination proof recipe: the response carries
 * literal top-level `@iot.nextLink` / `@iot.count` keys, addressable only
 * via the quoted-bracket path escape hatch (`['@iot.nextLink']`). The
 * gatherAll drain asserts the paginate loop actually walks past page 1 and
 * terminates — the exact behavior that silently broke pre-tokenizer.
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

const DIR = "frost-server-sensorthings";
const DOMAIN = "airquality-frost.k8s.ilt-dmz.iosb.fraunhofer.de";

const fetchOp = createFetchOp(DOMAIN);

// ═══════════════════════════════════════════════════════════════════
// Parse (bare CI — deterministic, no network)
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server recipe parses", () => {
	it(
		"parses cleanly with the quoted-bracket pagination block",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe(
				"https://airquality-frost.k8s.ilt-dmz.iosb.fraunhofer.de/v1.1",
			);
			expect(guide.auth.kind).toBe("none");
			expect(guide.operations.map((o) => o.name)).toEqual(["listThings"]);

			const pag = guide.operations[0]!.pagination ?? guide.pagination;
			expect(pag?.style).toBe("nextLink");
			expect(pag?.nextLinkPath).toBe("['@iot.nextLink']");
			expect(pag?.totalCountPath).toBe("['@iot.count']");
		}),
	);
});

// ═══════════════════════════════════════════════════════════════════
// Live (HOST_INTEGRATION=1)
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server live integration smoke", () => {
	itWhen(
		"listThings fetches a first page with the numeric @iot.count as serverTotal",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listThings", {
				$top: 10,
			})) as { items: Record<string, unknown>[]; serverTotal?: number };
			// Non-gatherAll → single page.
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items.length).toBeLessThanOrEqual(10);
			// totalCountPath: "['@iot.count']" resolves the numeric dotted-key
			// total and surfaces it as serverTotal.
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(0);
			// SensorThings Things carry a name + station properties bag.
			const first = result.items[0]!;
			expect(typeof first["name"]).toBe("string");
			expect(typeof first["properties"]).toBe("object");
		}),
		30_000,
	);

	itWhen(
		"listThings gatherAll walks past page 1 via ['@iot.nextLink'] (dotted-key proof)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { setUserGuidesDir, findGuidesByDomain } = await import(
				"pi-lean-host/core/guide-store.js"
			);
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			setUserGuidesDir(guidesDir);
			const match = findGuidesByDomain(DOMAIN)[0]!;
			const op = match.guide.operations.find((o) => o.name === "listThings")!;
			const result = (await paginate(
				match.guide.apiHost,
				op,
				{ $top: 10 },
				match.guide,
				{ gatherAll: true, gatherAllMax: 25 },
			)) as {
				items: unknown[];
				totalFetched: number;
				pages: number;
				urls: string[];
				serverTotal?: number;
				ceilingHit: boolean;
			};
			// $top=10, ceiling 25 → exactly 3 pages walked. Pre-tokenizer this
			// walk silently stopped after page 1 (unquoted-path miss semantics);
			// the quoted bracket path is what makes page 2+ reachable at all.
			expect(result.pages).toBe(3);
			expect(result.totalFetched).toBe(25);
			expect(result.items.length).toBe(25);
			expect(result.ceilingHit).toBe(true);
			// Page 2 was reached by following the server's nextLink URL.
			expect(result.urls.length).toBe(3);
			expect(result.urls[1]).toContain("$skip=10");
			// The numeric @iot.count survived the walk.
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(25);
		}),
		30_000,
	);
});
