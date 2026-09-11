/**
 * FROST-Server (SensorThings) recipe validity tests — endpoint coverage +
 * live fetch sanity.
 *
 * This is the dotted-key pagination proof recipe: every collection response
 * carries literal top-level `@iot.nextLink` / `@iot.count` keys, addressable
 * only via the quoted-bracket path escape hatch (`['@iot.nextLink']`). The
 * gatherAll drain asserts the paginate loop actually walks past page 1 and
 * terminates — the exact behavior that silently broke pre-tokenizer.
 *
 * Covers all 42 ops: 9 entity sets, 9 single entities, 15 collection
 * navigations, 8 single-entity navigations, 1 raw value.
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

// ── Per-recipe fetch helper (bootstrap shared via createFetchOp; pacing stays here) ──

// Fraunhofer's public research instance has no published anonymous rate
// limit; a small delay keeps the 42-op live sweep polite.
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const _fetch = createFetchOp(DOMAIN);

async function fetchOp(
	guidesDir: string,
	name: string,
	params: Record<string, unknown> = {},
) {
	await delay(200);
	return _fetch(guidesDir, name, params);
}

// ── Stable anchors (live-probed 2026-09-03) ─────────────────────────
const THING = 1; // station STA.09.LIES — 4 datastreams, 1 location, 2 HLs
const DATASTREAM = 1; // NO as Tamsweg — has Observations(1) with result 12.59…
const LOCATION = 1;
const SENSOR = 1;
const OBSERVED_PROPERTY = 1; // SO2
const FEATURE_OF_INTEREST = 287; // Observations(1)'s FoI
const HISTORICAL_LOCATION = 1;
const MULTIDATASTREAM = 16454;
const OBSERVATION = 1;

// ═══════════════════════════════════════════════════════════════════
// Parse (bare CI — deterministic, no network)
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server recipe parses", () => {
	it(
		"parses cleanly with the quoted-bracket pagination block and all 42 ops",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/guide-catalog.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe(
				"https://airquality-frost.k8s.ilt-dmz.iosb.fraunhofer.de/v1.1",
			);
			expect(guide.auth.kind).toBe("none");
			expect(guide.operations).toHaveLength(42);
			const names = guide.operations.map((o) => o.name);
			expect(names).toContain("listThings");
			expect(names).toContain("getObservationRawResult");

			// Guide-level pagination: the dotted-key shape.
			const pag = guide.operations[0]!.pagination ?? guide.pagination;
			expect(pag?.style).toBe("nextLink");
			expect(pag?.nextLinkPath).toBe("['@iot.nextLink']");
			expect(pag?.totalCountPath).toBe("['@iot.count']");

			// Collection ops inherit the quoted-bracket block and declare
			// $count on by default (totalCountPath resolves nothing without it).
			for (const op of guide.operations) {
				if (op.via !== "paginate") continue;
				const p = op.pagination ?? guide.pagination;
				expect(p?.nextLinkPath).toBe("['@iot.nextLink']");
				expect(op.params?.["$count"]?.default).toBe(true);
			}
		}),
	);
});

// ═══════════════════════════════════════════════════════════════════
// Baseline — the dotted-key pagination proofs
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

	itWhen(
		"passthrough forwards OData query options ($filter) onto the wire",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listThings", {
				$filter: "properties/countryCode eq 'DE'",
				$top: 5,
			})) as { items: { properties?: { countryCode?: string } }[] };
			expect(result.items.length).toBeGreaterThan(0);
			for (const item of result.items) {
				expect(item.properties?.countryCode).toBe("DE");
			}
		}),
		30_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group A — Entity-set collections
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server Group A — entity sets", () => {
	itWhen(
		"listDatastreams paginates with a numeric serverTotal",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listDatastreams", {
				$top: 3,
			})) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBe(3);
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(3);
		}),
		30_000,
	);

	itWhen(
		"listLocations returns station locations with GeoJSON points",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listLocations", {
				$top: 2,
			})) as {
				items: { location?: { type?: string; coordinates?: unknown[] } }[];
			};
			expect(result.items.length).toBe(2);
			expect(result.items[0]!.location?.type).toBe("Point");
			expect(Array.isArray(result.items[0]!.location?.coordinates)).toBe(true);
		}),
		30_000,
	);

	itWhen(
		"listSensors returns sensor descriptions",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listSensors", {
				$top: 2,
			})) as { items: { name?: unknown; metadata?: unknown }[] };
			expect(result.items.length).toBe(2);
			expect(typeof result.items[0]!.name).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"listObservedProperties returns the pollutant vocabulary",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listObservedProperties", {
				$top: 2,
			})) as { items: { name?: unknown; definition?: unknown }[] };
			expect(result.items.length).toBe(2);
			expect(typeof result.items[0]!.definition).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"listFeaturesOfInterest returns sampled features",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listFeaturesOfInterest", {
				$top: 2,
			})) as { items: { feature?: { type?: string } }[] };
			expect(result.items.length).toBe(2);
			expect(result.items[0]!.feature?.type).toBe("Point");
		}),
		30_000,
	);

	itWhen(
		"listHistoricalLocations paginates",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listHistoricalLocations", {
				$top: 2,
			})) as { items: { time?: unknown }[] };
			expect(result.items.length).toBe(2);
			expect(typeof result.items[0]!.time).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"listMultiDatastreams paginates the v1.1 extension set",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listMultiDatastreams", {
				$top: 2,
			})) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBe(2);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listObservations returns measurements with phenomenonTime + result",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listObservations", {
				$top: 3,
			})) as { items: { phenomenonTime?: unknown; result?: unknown }[] };
			expect(result.items.length).toBe(3);
			expect(typeof result.items[0]!.phenomenonTime).toBe("string");
			expect(result.items[0]!.result).toBeDefined();
		}),
		30_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group B — Single entities
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server Group B — single entities", () => {
	itWhen(
		"getThing returns one station with its properties bag",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getThing", {
				thingId: String(THING),
			})) as { data: { "@iot.id"?: number; properties?: unknown } };
			expect(result.data["@iot.id"]).toBe(THING);
			expect(typeof result.data.properties).toBe("object");
		}),
		30_000,
	);

	itWhen(
		"getDatastream returns unitOfMeasurement + observedArea",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getDatastream", {
				datastreamId: String(DATASTREAM),
			})) as { data: { unitOfMeasurement?: unknown } };
			expect(result.data.unitOfMeasurement).toBeTruthy();
		}),
		30_000,
	);

	itWhen(
		"getLocation returns the GeoJSON location",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getLocation", {
				locationId: String(LOCATION),
			})) as { data: { location?: { type?: string } } };
			expect(result.data.location?.type).toBe("Point");
		}),
		30_000,
	);

	itWhen(
		"getSensor returns the sensor description",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getSensor", {
				sensorId: String(SENSOR),
			})) as { data: { "@iot.id"?: number } };
			expect(result.data["@iot.id"]).toBe(SENSOR);
		}),
		30_000,
	);

	itWhen(
		"getObservedProperty returns the pollutant definition",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getObservedProperty", {
				observedPropertyId: String(OBSERVED_PROPERTY),
			})) as { data: { definition?: unknown } };
			expect(typeof result.data.definition).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"getFeatureOfInterest returns the sampled feature",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getFeatureOfInterest", {
				featureOfInterestId: String(FEATURE_OF_INTEREST),
			})) as { data: { "@iot.id"?: number } };
			expect(result.data["@iot.id"]).toBe(FEATURE_OF_INTEREST);
		}),
		30_000,
	);

	itWhen(
		"getHistoricalLocation returns the historical link",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getHistoricalLocation", {
				historicalLocationId: String(HISTORICAL_LOCATION),
			})) as { data: { time?: unknown } };
			expect(typeof result.data.time).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"getMultiDatastream returns multiObservationDataTypes",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getMultiDatastream", {
				multiDatastreamId: String(MULTIDATASTREAM),
			})) as { data: { multiObservationDataTypes?: unknown[] } };
			expect(Array.isArray(result.data.multiObservationDataTypes)).toBe(true);
		}),
		30_000,
	);

	itWhen(
		"getObservation returns the measurement",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getObservation", {
				observationId: String(OBSERVATION),
			})) as { data: { result?: unknown } };
			expect(typeof result.data.result).toBe("number");
		}),
		30_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group C — Collection navigations
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server Group C — collection navigations", () => {
	itWhen(
		"listThingDatastreams paginates a Thing's datastreams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listThingDatastreams", {
				thingId: String(THING),
			})) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBeGreaterThan(0);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listThingMultiDatastreams paginates a Thing's multidatastreams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listThingMultiDatastreams", {
				thingId: String(THING),
			})) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBeGreaterThan(0);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listThingLocations returns the Thing's locations",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listThingLocations", {
				thingId: String(THING),
			})) as { items: { location?: { type?: string } }[] };
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items[0]!.location?.type).toBe("Point");
		}),
		30_000,
	);

	itWhen(
		"listThingHistoricalLocations paginates the Thing's history",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listThingHistoricalLocations", {
				thingId: String(THING),
			})) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBeGreaterThan(0);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listLocationThings resolves the Thing at a Location",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listLocationThings", {
				locationId: String(LOCATION),
			})) as { items: { "@iot.id"?: number }[] };
			expect(result.items.length).toBeGreaterThan(0);
			expect(result.items[0]!["@iot.id"]).toBe(THING);
		}),
		30_000,
	);

	itWhen(
		"listLocationHistoricalLocations paginates the Location's history",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listLocationHistoricalLocations",
				{ locationId: String(LOCATION) },
			)) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBeGreaterThan(0);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listHistoricalLocationLocations resolves the Location(s) of a HistoricalLocation",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listHistoricalLocationLocations",
				{ historicalLocationId: String(HISTORICAL_LOCATION) },
			)) as { items: unknown[] };
			expect(result.items.length).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"listDatastreamObservations paginates the time series with a serverTotal",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listDatastreamObservations", {
				datastreamId: String(DATASTREAM),
				$top: 5,
			})) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBe(5);
			// This Datastream's series is huge (70k+) — the per-collection
			// @iot.count must reflect it, not the global Observation count.
			expect(result.serverTotal!).toBeGreaterThan(1000);
		}),
		30_000,
	);

	itWhen(
		"listSensorDatastreams resolves the Sensor's datastreams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listSensorDatastreams", {
				sensorId: String(SENSOR),
			})) as { items: unknown[] };
			expect(result.items.length).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"listSensorMultiDatastreams paginates the Sensor's multidatastreams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "listSensorMultiDatastreams", {
				sensorId: String(SENSOR),
			})) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBeGreaterThan(0);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listObservedPropertyDatastreams paginates the pollutant's datastreams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listObservedPropertyDatastreams",
				{ observedPropertyId: String(OBSERVED_PROPERTY), $top: 5 },
			)) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBe(5);
			expect(typeof result.serverTotal).toBe("number");
			expect(result.serverTotal!).toBeGreaterThan(5);
		}),
		30_000,
	);

	itWhen(
		"listObservedPropertyMultiDatastreams paginates the pollutant's multidatastreams",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listObservedPropertyMultiDatastreams",
				{ observedPropertyId: String(OBSERVED_PROPERTY), $top: 3 },
			)) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBe(3);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listFeatureOfInterestObservations paginates the feature's observations",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listFeatureOfInterestObservations",
				{ featureOfInterestId: String(FEATURE_OF_INTEREST), $top: 3 },
			)) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBe(3);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listMultiDatastreamObservations paginates the multidatastream's observations",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listMultiDatastreamObservations",
				{ multiDatastreamId: String(MULTIDATASTREAM), $top: 3 },
			)) as { items: unknown[]; serverTotal?: number };
			expect(result.items.length).toBe(3);
			expect(typeof result.serverTotal).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"listMultiDatastreamObservedProperties resolves the measured properties",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"listMultiDatastreamObservedProperties",
				{ multiDatastreamId: String(MULTIDATASTREAM) },
			)) as { items: unknown[] };
			expect(result.items.length).toBeGreaterThan(0);
		}),
		30_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group D — Single-entity navigations
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server Group D — single-entity navigations", () => {
	itWhen(
		"getHistoricalLocationThing resolves the Thing",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getHistoricalLocationThing", {
				historicalLocationId: String(HISTORICAL_LOCATION),
			})) as { data: { "@iot.id"?: number } };
			expect(result.data["@iot.id"]).toBe(THING);
		}),
		30_000,
	);

	itWhen(
		"getDatastreamThing resolves the Thing",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getDatastreamThing", {
				datastreamId: String(DATASTREAM),
			})) as { data: { "@iot.id"?: number } };
			// Datastream 1's Thing (live-probed 2026-09-03).
			expect(result.data["@iot.id"]).toBe(165);
		}),
		30_000,
	);

	itWhen(
		"getDatastreamSensor resolves the Sensor",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getDatastreamSensor", {
				datastreamId: String(DATASTREAM),
			})) as { data: { "@iot.id"?: number } };
			expect(typeof result.data["@iot.id"]).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"getDatastreamObservedProperty resolves the ObservedProperty",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"getDatastreamObservedProperty",
				{
					datastreamId: String(DATASTREAM),
				},
			)) as { data: { "@iot.id"?: number } };
			expect(typeof result.data["@iot.id"]).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"getMultiDatastreamThing resolves the Thing",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getMultiDatastreamThing", {
				multiDatastreamId: String(MULTIDATASTREAM),
			})) as { data: { "@iot.id"?: number } };
			expect(typeof result.data["@iot.id"]).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"getMultiDatastreamSensor resolves the Sensor",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getMultiDatastreamSensor", {
				multiDatastreamId: String(MULTIDATASTREAM),
			})) as { data: { "@iot.id"?: number } };
			expect(typeof result.data["@iot.id"]).toBe("number");
		}),
		30_000,
	);

	itWhen(
		"getObservationDatastream resolves the parent Datastream",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getObservationDatastream", {
				observationId: String(OBSERVATION),
			})) as { data: { "@iot.id"?: number } };
			expect(result.data["@iot.id"]).toBe(DATASTREAM);
		}),
		30_000,
	);

	itWhen(
		"getObservationFeatureOfInterest resolves the sampled feature",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(
				guidesDir,
				"getObservationFeatureOfInterest",
				{ observationId: String(OBSERVATION) },
			)) as { data: { "@iot.id"?: number } };
			expect(result.data["@iot.id"]).toBe(FEATURE_OF_INTEREST);
		}),
		30_000,
	);
});

// ═══════════════════════════════════════════════════════════════════
// Group E — Raw value
// ═══════════════════════════════════════════════════════════════════

describe("FROST-Server Group E — raw value", () => {
	itWhen(
		"getObservationRawResult returns the bare measurement number",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const result = (await fetchOp(guidesDir, "getObservationRawResult", {
				datastreamId: String(DATASTREAM),
				observationId: String(OBSERVATION),
			})) as { data: unknown };
			// $value body is a lone JSON number parsed straight through.
			expect(typeof result.data).toBe("number");
		}),
		30_000,
	);
});
