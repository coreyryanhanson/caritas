/**
 * OpenStreetMap recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * Verifies the oauth2 authorization_code path end-to-end against the live
 * API v0.6: resolves the client_id/client_secret store secrets, reads the
 * user access token from its slot — (openstreetmap.org, authorization_code,
 * tokenUrl) — and injects `Authorization: Bearer` on every call (public
 * map-data reads tolerate the token; me/myPreferences/myTraces require it
 * via the read_prefs / read_gpx scopes).
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires provisioned
 * credentials at `/api secrets openstreetmap.org` (names: client_id,
 * client_secret) and a minted token at the authorization_code slot
 * (`/api oauth openstreetmap.org` paste flow, scopes read_prefs read_gpx).
 *
 * OSM access tokens currently do not expire (no refresh path exercised).
 * All operations are read-only; XML-only endpoints (osmChange download,
 * GPX trackpoints/trace data) are declared `parse: {format: xml}`.
 */

import type { RestGetResult } from "pi-lean-host/core/helpers.js";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "openstreetmap.org";
const DIR = "openstreetmap";
const TOKEN_URL = "https://www.openstreetmap.org/oauth2/token";

/** The token user (me → id/display_name) — pinned by the live suite. */
const ME_ID = 9494385;
const ME_NAME = "sofuego";

/** Well-known stable map elements around a tiny central-London bbox. */
const WAY_ID = 157534206;
const RELATION_ID = 5492192;
const NODE_ID = 1697708123;
/** A closed changeset from 2026-08 (closed changesets are immutable). */
const CHANGESET_ID = 188189044;
/** A closed map note (immutable; 410 only when hidden by a moderator). */
const NOTE_ID = 5486549;
/** A public GPS trace (metadata + data readable without ownership). */
const GPX_ID = 1000000;

/**
 * Locate the OpenStreetMap guide (dirName `openstreetmap`) in a temp guides
 * dir. `opName` disambiguates if sibling guides ever claim the domain.
 */
async function guideFor(guidesDir: string, opName = "me") {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	return findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === opName),
	)!;
}

/** Run one op of the OpenStreetMap guide through the shared resolveOp sequence. */
async function runOp(
	guidesDir: string,
	opName: string,
	params: Record<string, unknown> = {},
) {
	const { resolveOpForExecution } = await import(
		"pi-lean-host/core/resolve-op.js"
	);
	const hit = await guideFor(guidesDir, opName);
	const op = hit.guide.operations.find((o) => o.name === opName)!;
	const outcome = await resolveOpForExecution(hit.guide, op, hit.dirName, {
		userParams: params,
	});
	expect(outcome.ok).toBe(true);
	return outcome.ok ? outcome : undefined;
}

/** The standard OSM JSON envelope every cgimap/rails elements reply carries. */
function expectOsmEnvelope(data: unknown): Record<string, unknown> {
	const d = data as Record<string, unknown>;
	expect(d.version).toBe("0.6");
	expect(typeof d.generator).toBe("string");
	expect(typeof d.copyright).toBe("string");
	return d;
}

/** Output-channel audit: a token must never surface on a surfaced URL. */
function expectNoTokenOnUrls(
	outcome: NonNullable<Awaited<ReturnType<typeof runOp>>>,
) {
	const result = outcome.result as RestGetResult;
	expect(result.url).not.toContain("access_token");
}

describe("OpenStreetMap recipe structure (always-on)", () => {
	it(
		"declares the oauth2 authorization_code shape",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const loaded = loadApiGuidesFromDir(guidesDir);
			expect(Object.keys(loaded.guides)).toContain(DIR);
			expect(loaded.malformed).toHaveLength(0);

			const guide = loaded.guides[DIR]!;
			expect(guide.apiHost).toBe("https://api.openstreetmap.org");
			expect(guide.auth.kind).toBe("oauth2");
			if (guide.auth.kind !== "oauth2") return; // exhaustiveness narrowing
			expect(guide.auth.grant).toBe("authorization_code");
			expect(guide.auth.tokenUrl).toBe(TOKEN_URL);
			expect(guide.auth.authorizeUrl).toBe(
				"https://www.openstreetmap.org/oauth2/authorize",
			);
			expect(guide.auth.clientId.secret).toBe("client_id");
			expect(guide.auth.clientSecret?.secret).toBe("client_secret");
			expect(guide.auth.tokenEndpointAuthMethod).toBe("client_secret_post");
			expect(guide.auth.scopes).toEqual(["read_prefs", "read_gpx"]);
		}),
	);

	it(
		"declares every read-only operation, all GET via restGet",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { loadApiGuidesFromDir } = await import(
				"pi-lean-host/core/parse-api-guide.js"
			);
			const guide = loadApiGuidesFromDir(guidesDir).guides[DIR]!;
			const byName = new Map(guide.operations.map((o) => [o.name, o]));

			expect([...byName.keys()].sort()).toEqual(
				[
					"versions",
					"capabilities",
					"map",
					"permissions",
					"changesets",
					"changeset",
					"changesetDownload",
					"changesetComments",
					"element",
					"elementHistory",
					"elementVersion",
					"elementRelations",
					"elementFull",
					"nodeWays",
					"fetchNodes",
					"fetchWays",
					"fetchRelations",
					"trackpoints",
					"gpxMetadata",
					"gpxData",
					"myTraces",
					"me",
					"myPreferences",
					"myActiveBlocks",
					"user",
					"users",
					"notes",
					"note",
					"notesSearch",
				].sort(),
			);

			// Read-only guarantee: every op is restGet (the recipe surface
			// cannot express a mutation even if a path were mis-copied).
			for (const op of byName.values()) {
				expect(op.via).toBe("restGet");
			}

			// XML-only endpoints declare the xml parse shape; JSON ones ride
			// the guide-level json responseShape.
			for (const name of ["changesetDownload", "trackpoints", "gpxData"]) {
				expect(byName.get(name)!.parse?.format).toBe("xml");
			}

			// Required params: only the selector the endpoint cannot omit.
			for (const [name, required] of [
				["map", ["bbox"]],
				["fetchNodes", ["nodes"]],
				["fetchWays", ["ways"]],
				["fetchRelations", ["relations"]],
				["users", ["users"]],
				["notes", ["bbox"]],
			] as const) {
				const params = byName.get(name)!.params!;
				const gotRequired = Object.entries(params)
					.filter(([, p]) => p.required)
					.map(([k]) => k);
				expect(gotRequired).toEqual(required);
			}
		}),
	);
});

describe("OpenStreetMap live integration (oauth2 authorization_code)", () => {
	itWhen(
		"me returns the token user's details (read_prefs)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "me"))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as {
				user: Record<string, unknown>;
			};
			expect(data.user.id).toBe(ME_ID);
			expect(data.user.display_name).toBe(ME_NAME);
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"permissions echoes the granted scopes as allow_* permissions",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "permissions"))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { permissions: string[] };
			expect(data.permissions).toContain("allow_read_prefs");
			expect(data.permissions).toContain("allow_read_gpx");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"versions + capabilities describe the API",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const versions = expectOsmEnvelope(
				((await runOp(guidesDir, "versions"))! as { result: RestGetResult })
					.result.data,
			) as { api: { versions: string[] } };
			expect(versions.api.versions).toContain("0.6");

			const capabilities = expectOsmEnvelope(
				(
					(await runOp(guidesDir, "capabilities"))! as {
						result: RestGetResult;
					}
				).result.data,
			) as { api: unknown };
			expect(typeof capabilities.api).toBe("object");
		}),
	);

	itWhen(
		"map reads a tiny central-London bbox (nodes, ways, relations)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "map", {
				bbox: "-0.1357,51.5055,-0.1350,51.5060",
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { elements: Array<Record<string, unknown>> };
			const types = new Set(data.elements.map((e) => e.type));
			expect(types.has("node")).toBe(true);
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"element reads a way by (type, id)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "element", {
				type: "way",
				id: WAY_ID,
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { elements: Array<Record<string, unknown>> };
			expect(data.elements).toHaveLength(1);
			expect(data.elements[0]!.id).toBe(WAY_ID);
			expect(typeof data.elements[0]!.version).toBe("number");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"elementHistory returns ascending versions",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "elementHistory", {
				type: "way",
				id: WAY_ID,
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { elements: Array<Record<string, unknown>> };
			const vs = data.elements.map((e) => Number(e.version));
			expect(vs.length).toBeGreaterThan(1);
			for (let i = 1; i < vs.length; i++)
				expect(vs[i]).toBeGreaterThan(vs[i - 1]!);
		}),
	);

	itWhen(
		"elementVersion reads a specific past version",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "elementVersion", {
				type: "way",
				id: WAY_ID,
				version: 2,
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { elements: Array<Record<string, unknown>> };
			expect(data.elements[0]!.version).toBe(2);
		}),
	);

	itWhen(
		"elementFull returns the way plus its nodes",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "elementFull", {
				type: "way",
				id: WAY_ID,
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { elements: Array<Record<string, unknown>> };
			const types = new Set(data.elements.map((e) => e.type));
			expect(types.has("way")).toBe(true);
			expect(types.has("node")).toBe(true);
		}),
	);

	itWhen(
		"elementRelations returns an empty elements list when unused (200, no error)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "elementRelations", {
				type: "way",
				id: WAY_ID,
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { elements: unknown[] };
			expect(Array.isArray(data.elements)).toBe(true);
		}),
	);

	itWhen(
		"nodeWays reads the ways a node belongs to",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "nodeWays", {
				id: NODE_ID,
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { elements: Array<Record<string, unknown>> };
			for (const w of data.elements) expect(w.type).toBe("way");
		}),
	);

	itWhen(
		"multi-fetch reads nodes/ways/relations by id list",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const nodes = expectOsmEnvelope(
				(
					(await runOp(guidesDir, "fetchNodes", { nodes: String(NODE_ID) }))!
						.result as RestGetResult
				).data,
			) as { elements: Array<Record<string, unknown>> };
			expect(nodes.elements[0]!.id).toBe(NODE_ID);

			const ways = expectOsmEnvelope(
				(
					(await runOp(guidesDir, "fetchWays", { ways: String(WAY_ID) }))!
						.result as RestGetResult
				).data,
			) as { elements: Array<Record<string, unknown>> };
			expect(ways.elements[0]!.id).toBe(WAY_ID);

			const rels = expectOsmEnvelope(
				(
					(await runOp(guidesDir, "fetchRelations", {
						relations: String(RELATION_ID),
					}))! as { result: RestGetResult }
				).result.data,
			) as { elements: Array<Record<string, unknown>> };
			expect(rels.elements[0]!.id).toBe(RELATION_ID);
		}),
	);

	itWhen(
		"changesets query returns closed changesets in the bbox (≤ limit)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "changesets", {
				bbox: "-0.1357,51.5055,-0.1350,51.5060",
				closed: true,
				limit: 3,
			}))!;
			// The list rides a `changesets` key (cgimap 2.0 rails-aligned
			// shape), not the `elements` array the map/element endpoints use.
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { changesets: Array<Record<string, unknown>> };
			expect(data.changesets.length).toBeGreaterThan(0);
			expect(data.changesets.length).toBeLessThanOrEqual(3);
			// List entries carry id/open/changes_count but no `type` tag
			// (unlike map/element responses) — pin the identifying fields.
			for (const c of data.changesets) {
				expect(typeof c.id).toBe("number");
				expect(c.open).toBe(false);
			}
		}),
	);

	itWhen(
		"changeset reads a closed changeset; download returns the parsed osmChange diff",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "changeset", {
				id: CHANGESET_ID,
			}))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { changeset: Record<string, unknown> };
			expect(data.changeset.id).toBe(CHANGESET_ID);
			expect(data.changeset.open).toBe(false);

			const dl = (await runOp(guidesDir, "changesetDownload", {
				id: CHANGESET_ID,
			}))!;
			const diff = (dl.result as RestGetResult).data as Record<string, unknown>;
			// osmChange XML → fast-xml-parser keys; the diff carries change
			// buckets (create/modify/delete) with OSM elements inside.
			expect(Object.keys(diff)).toContain("osmChange");
			expectNoTokenOnUrls(dl);
		}),
	);

	itWhen(
		"changesetComments lists recent comments",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "changesetComments"))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { comments: unknown[] };
			expect(Array.isArray(data.comments)).toBe(true);
		}),
	);

	itWhen(
		"trackpoints returns parsed GPX for a small bbox",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "trackpoints", {
				bbox: "0,51.5,0.25,51.75",
			}))!;
			const data = (outcome.result as RestGetResult).data as Record<
				string,
				unknown
			>;
			// GPX 1.0 XML → parsed gpx element (may carry zero trkpts).
			expect(data.gpx).toBeDefined();
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"myTraces lists the token user's GPS traces (read_gpx; empty ok)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "myTraces"))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { traces: unknown[] };
			expect(Array.isArray(data.traces)).toBe(true);
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"gpxMetadata + gpxData read a public trace",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const meta = (await runOp(guidesDir, "gpxMetadata", {
				id: GPX_ID,
			}))!;
			const data = expectOsmEnvelope((meta.result as RestGetResult).data) as {
				trace: Record<string, unknown>;
			};
			expect(data.trace.id).toBe(GPX_ID);
			expect(data.trace.visibility).toBe("public");

			const dataOutcome = (await runOp(guidesDir, "gpxData", {
				id: GPX_ID,
			}))!;
			const gpx = (dataOutcome.result as RestGetResult).data as Record<
				string,
				unknown
			>;
			expect(gpx.gpx).toBeDefined();
		}),
	);

	itWhen(
		"user + users read public user details",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "user", { id: ME_ID }))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { user: Record<string, unknown> };
			expect(data.user.id).toBe(ME_ID);

			const multi = (await runOp(guidesDir, "users", {
				users: String(ME_ID),
			}))!;
			const md = expectOsmEnvelope((multi.result as RestGetResult).data) as {
				users: Array<{ user: Record<string, unknown> }>;
			};
			// Each list entry nests the user under `user` (rails-aligned shape).
			expect(md.users.map((u) => u.user.id)).toContain(ME_ID);
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"myPreferences lists the token user's preferences (read_prefs)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "myPreferences"))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { preferences: Record<string, unknown> };
			expect(typeof data.preferences).toBe("object");
			expectNoTokenOnUrls(outcome);
		}),
	);

	itWhen(
		"myActiveBlocks returns an empty (or populated) user_blocks list",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "myActiveBlocks"))!;
			const data = expectOsmEnvelope(
				(outcome.result as RestGetResult).data,
			) as { user_blocks: unknown[] };
			expect(Array.isArray(data.user_blocks)).toBe(true);
		}),
	);

	itWhen(
		"notes reads a London bbox; note reads a closed note by id",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "notes", {
				bbox: "-0.2,51.45,0.05,51.55",
				closed: -1,
				limit: 2,
			}))!;
			const fc = (outcome.result as RestGetResult).data as {
				type: string;
				features: Array<Record<string, unknown>>;
			};
			expect(fc.type).toBe("FeatureCollection");
			expect(fc.features.length).toBeGreaterThan(0);

			const noteOutcome = (await runOp(guidesDir, "note", {
				id: NOTE_ID,
			}))!;
			const note = (noteOutcome.result as RestGetResult).data as {
				type: string;
				properties: Record<string, unknown>;
			};
			expect(note.type).toBe("Feature");
			expect(note.properties.id).toBe(NOTE_ID);
			expectNoTokenOnUrls(noteOutcome);
		}),
	);

	itWhen(
		"notesSearch returns the most recently updated notes",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const outcome = (await runOp(guidesDir, "notesSearch", { limit: 1 }))!;
			const fc = (outcome.result as RestGetResult).data as {
				type: string;
				features: unknown[];
			};
			expect(fc.type).toBe("FeatureCollection");
			expect(fc.features.length).toBeLessThanOrEqual(1);
		}),
	);
});
