/**
 * Corpus-wide parse gate (bare CI, no network).
 *
 * Every guide in the repo must parse cleanly through the real parser.
 * Most per-guide endpoint-coverage tests are HOST_INTEGRATION-gated, so
 * bare CI never loads them — this is the check that catches malformed
 * YAML, unknown param-spec keys, and invalid `listStyle` values
 * corpus-wide. Parse-refused guides silently vanish from api-fetch, so a
 * new malformed guide must fail here, not at call time.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadApiGuidesFromDir } from "pi-lean-host/core/parse-api-guide.js";
import { expect, it } from "vitest";

// This file lives in api-guides/, which is the guides root.
const GUIDES_DIR = dirname(fileURLToPath(import.meta.url));

it("every guide in the corpus parses (nothing malformed)", () => {
	const { guides, malformed } = loadApiGuidesFromDir(GUIDES_DIR);
	expect(
		malformed.map(({ dirName }) => dirName),
		"malformed guides (they silently vanish from api-fetch)",
	).toEqual([]);
	expect(Object.keys(guides).length).toBeGreaterThan(0);
});
