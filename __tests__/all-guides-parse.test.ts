/**
 * caritas parse-validity — every bundled recipe parses cleanly against the
 * `pi-lean-host` parser (package import, resolving the local devDep's
 * `exports` map). No network. This is caritas's per-PR parse gate
 * (Sprint 5's parse-validity CI tier); recipe-correctness mock-transport
 * tests (`transform.test.ts`, `helper.test.ts`) live alongside each recipe.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseApiGuide } from "pi-lean-host/core/parse-api-guide.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GUIDES_DIR = join(__dirname, "..", "api-guides");

function discoverGuides(): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(GUIDES_DIR)) {
		const guidePath = join(GUIDES_DIR, entry, "guide.md");
		try {
			if (statSync(guidePath).isFile()) out.push(entry);
		} catch {
			// not a directory or no guide.md — skip
		}
	}
	return out.sort();
}

const guideDomains = discoverGuides();

describe("all caritas recipes parse against pi-lean-host", () => {
	it(`discovers ${guideDomains.length} recipes in api-guides/`, () => {
		expect(guideDomains.length).toBeGreaterThanOrEqual(4);
	});

	for (const domain of guideDomains) {
		it(`${domain} parses cleanly`, () => {
			const guidePath = join(GUIDES_DIR, domain, "guide.md");
			const raw = readFileSync(guidePath, "utf-8");
			const result = parseApiGuide(raw, { file: guidePath, filename: domain });

			if (!result.ok) {
				throw new Error(
					`${domain}: ${result.error.field} — expected ${result.error.expected}, found ${result.error.found}` +
						(result.error.fix ? `\n  Fix: ${result.error.fix}` : ""),
				);
			}

			expect(result.guide.apiHost).toBeTruthy();
			expect(result.guide.operations.length).toBeGreaterThan(0);
			expect(["none", "static-key"]).toContain(result.guide.auth.kind);
			for (const op of result.guide.operations) {
				expect(["restGet", "paginate"]).toContain(op.via);
				expect(op.path).toMatch(/^\//);
			}
		});
	}
});
