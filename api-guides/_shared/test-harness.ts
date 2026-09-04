/**
 * Shared recipe-setup harness for co-located guide tests.
 *
 * Layer 1 only: temp-dir plumbing. Copies guide folders into a throwaway dir
 * so the real `apiFetch` pipeline runs against an isolated user-guides dir.
 * This is the part that is byte-for-byte identical across every guide's
 * tests; it never touches any API.
 *
 * Layer 1.5 — the keyed-guide resolve-op seam: `createResolveOpFn` runs one
 * op through the canonical `resolveOpForExecution` pipeline (the exact path
 * api-fetch and /api verify ride), so keyed guides' live tests stop
 * re-implementing the auth-resolution sequence per-file.
 *
 * Layer 2 — the `fetchOp` wrapper + per-op assertions — stays per-file. The
 * wrapper encodes domain-specific shape (delay, 503-retry) and
 * cannot be shared. Auth resolution is not per-file: keyed guides ride the
 * `createResolveOpFn` pipeline above. But the bare bootstrap (load recipe, dispatch on `via`) is
 * generic and lives here as `createFetchOp`; per-file wrappers compose around it.
 *
 * Not under `core/`: this is peer test plumbing, not framework code. A guide
 * imports it via a relative path (`../_shared/test-harness.js`); base code
 * never imports it.
 */

import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { TransformFn } from "pi-lean-host/core/local-helpers.js";
import { it } from "vitest";

const _dirname = dirname(fileURLToPath(import.meta.url));
// _shared/ lives one level under api-guides/, so the guides root is its parent.
const REPO_API_GUIDES = join(_dirname, "..");

function copyDir(src: string, dest: string): void {
	if (!existsSync(src)) return;
	const entries = readdirSync(src);
	mkdirSync(dest, { recursive: true });
	for (const entry of entries) {
		const srcPath = join(src, entry);
		const destPath = join(dest, entry);
		if (statSync(srcPath).isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			copyFileSync(srcPath, destPath);
		}
	}
}

function copyDomains(guidesDir: string, ...domains: string[]): void {
	for (const domain of domains) {
		const src = join(REPO_API_GUIDES, domain);
		if (!existsSync(src)) throw new Error(`Recipe folder not found: ${src}`);
		copyDir(src, join(guidesDir, domain));
	}
}

export interface TempDirs {
	guidesDir: string;
}

const HOST_INTEGRATION = process.env["HOST_INTEGRATION"] === "1";

/** Live-gate: runs the test only under HOST_INTEGRATION=1, else it.skip. */
export const itWhen = (HOST_INTEGRATION ? it : it.skip) as typeof it;

/**
 * Generic fetchOp bootstrap: load the recipe from `guidesDir`, find the named
 * op, and dispatch on the op's own `via` (restGet | paginate). Encodes no
 * domain shape. For delay/retry/auth-overlay, compose a per-file wrapper
 * around the returned function — do NOT add options here.
 */
export function createFetchOp(
	domain: string,
): (
	guidesDir: string,
	name: string,
	params?: Record<string, unknown>,
) => Promise<unknown> {
	return async (guidesDir, name, params = {}) => {
		const { restGet, paginate } = await import("pi-lean-host/core/helpers.js");
		const { setUserGuidesDir, findGuidesByDomain } = await import(
			"pi-lean-host/core/guide-store.js"
		);
		setUserGuidesDir(guidesDir);
		// Resolve like the real api-fetch tool: every guide claiming `domain`,
		// then the op by name across all matches (multi-recipe safe).
		const match = findGuidesByDomain(domain).find(({ guide }) =>
			guide.operations.some((o) => o.name === name),
		)!;
		const op = match.guide.operations.find((o) => o.name === name)!;
		// Mirror api-fetch's transform wiring: when the op declares
		// `transform: true`, load the named `transform` export from the
		// matched guide's helper.ts and pass it into the executor. Without
		// this, a transform-adopting op run through the harness would return
		// raw data and the live assertions would be a silent lie.
		let transformFn: TransformFn | null = null;
		if (op.transform === true) {
			const { loadTransform } = await import(
				"pi-lean-host/core/local-helpers.js"
			);
			transformFn = await loadTransform(match.dirName);
		}
		const passTransform = transformFn ?? undefined;
		return op.via === "paginate"
			? paginate(
					match.guide.apiHost,
					op,
					params,
					match.guide,
					undefined,
					passTransform,
					match.dirName,
				)
			: restGet(
					match.guide.apiHost,
					op,
					params,
					match.guide,
					undefined,
					passTransform,
					match.dirName,
				);
	};
}

/**
 * Run one op through the canonical resolve-op pipeline (the exact path
 * api-fetch and /api verify ride): load the guide by domain, resolve the op
 * by name across all matches, execute — auth resolution, helper dispatch and
 * transform wiring all happen inside the pipeline, so per-guide copies of
 * that sequence go away. Throws on every failure mode — pipeline rejection
 * (helper_disabled / auth_required_not_provisioned / oauth_token_missing)
 * and executor throw (HTTP >= 400 HelperError) alike — so the live tier's
 * happy path stays single-expression. Callers wanting the failure envelope
 * catch around this helper.
 */
export function createResolveOpFn(
	domain: string,
): (
	guidesDir: string,
	name: string,
	params?: Record<string, unknown>,
) => Promise<unknown> {
	return async (guidesDir, name, params = {}) => {
		const { setUserGuidesDir, findGuidesByDomain } = await import(
			"pi-lean-host/core/guide-store.js"
		);
		const { resolveOpForExecution } = await import(
			"pi-lean-host/core/resolve-op.js"
		);
		setUserGuidesDir(guidesDir);
		// Resolve like the real api-fetch tool: every guide claiming `domain`,
		// then the op by name across all matches (multi-recipe safe). Explicit
		// throw instead of `!` so a typo'd op name reads as a message, not a
		// context-free undefined deref.
		const match = findGuidesByDomain(domain).find(({ guide }) =>
			guide.operations.some((o) => o.name === name),
		);
		if (!match) throw new Error(`op ${name} not found for ${domain}`);
		const op = match.guide.operations.find((o) => o.name === name)!;
		const res = await resolveOpForExecution(match.guide, op, match.dirName, {
			userParams: params,
		});
		if (!res.ok) {
			// The structured failure payload: which secrets the store lacks for
			// auth_required_not_provisioned, the human-readable nudge otherwise.
			const detail =
				res.reason === "auth_required_not_provisioned"
					? res.missing.join(", ")
					: res.message;
			throw new Error(`${name}: pipeline rejected — ${res.reason}: ${detail}`);
		}
		return res.result;
	};
}

/**
 * Wrap a test body in temp-dir setup/teardown. Pass the domains to copy in.
 * Returns a fn suitable for `it(..., harness("boletin-oficial-del-estado")(async ({ guidesDir }) => { ... }))`.
 * Vitest's test context (e.g. for `ctx.skip()` inside chain tests) is
 * forwarded as the second argument when the harness runs the body.
 *
 * No-op (returns immediately) when `HOST_INTEGRATION !== "1"`, so bare CI
 * skips the live path without touching the filesystem.
 */
export function withTempDirs(
	...domainsToCopy: string[]
): (
	fn: (
		dirs: TempDirs,
		ctx?: { skip: (note?: string) => void },
	) => Promise<void>,
) => (...args: unknown[]) => Promise<void> {
	const HOST_INTEGRATION = process.env["HOST_INTEGRATION"] === "1";
	return (fn) => {
		return async (...args: unknown[]) => {
			if (!HOST_INTEGRATION) return;
			const guidesDir = mkdtempSync(join(tmpdir(), "pi-host-smoke-guides-"));
			try {
				copyDomains(guidesDir, ...domainsToCopy);
				await (fn as (...a: unknown[]) => Promise<void>)(
					{ guidesDir },
					...args,
				);
			} finally {
				rmSync(guidesDir, { recursive: true, force: true });
			}
		};
	};
}
