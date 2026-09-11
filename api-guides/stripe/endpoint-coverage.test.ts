/**
 * Stripe recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * This is the live proof of the `hasMorePath` half: the
 * `has_more` + `starting_after = data[-1].id` walk executed end-to-end
 * against the real Stripe API with a read-only restricted key.
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires a
 * provisioned restricted key at `/api secrets stripe.com`.
 *
 * Assertions are deliberately value-agnostic: envelope mechanics and
 * pagination behavior only, never record contents — the account's data
 * differs per key, so no expected id/email/count is hardcoded. Ops
 * that need a parent id source it from the parent list at runtime and
 * skip when the parent list is empty (fresh test accounts have none).
 *
 * Coverage note: the op inventory and the documented omissions
 * (Issuing, feature-gated 404s, the v2 surface, the retrieve family)
 * live in endpoint-coverage-plan.md — the frozen audit deliverable.
 */

import type { ApiGuide, Operation } from "pi-lean-host/core/api-guide-types.js";
import { loadApiGuidesFromDir } from "pi-lean-host/core/guide-catalog.js";
import { describe, expect, it } from "vitest";
import { itWhen, withTempDirs } from "../_shared/test-harness.js";

const DOMAIN = "stripe.com";
const DIR = "stripe";

/** Point the guide store at the temp copy and resolve the Stripe guide. */
async function loadGuide(guidesDir: string): Promise<ApiGuide> {
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	return findGuidesByDomain(DOMAIN).at(-1)!.guide;
}

/** Resolve the stored key-injected auth opts for live calls. */
async function authFor(guide: ApiGuide) {
	const { resolveSecretHeaders } = await import("pi-lean-host/core/auth.js");
	const res = resolveSecretHeaders(guide.auth, DOMAIN);
	expect(res.absentRequired).toEqual([]);
	expect(res.headers["Authorization"]).toMatch(/^Bearer /);
	return {
		authHeaders: res.headers,
		secretHeaderNames: new Set(["Authorization"]),
		secretValues: Object.values(res.headers),
	};
}

/** Paginate ops a plain `{}` call can drive: no required params and no
 * path-template token. The nested foreign-key ops and listPaymentMethods
 * (whose `type` is required) get their own tests. */
function isUnkeyedPaginateOp(op: Operation): boolean {
	if (op.via !== "paginate") return false;
	if (op.path.includes("{")) return false; // path-param ops get their own chain tests
	const hasRequired = Object.values(op.params ?? {}).some((p) => p.required);
	return !hasRequired;
}

describe("Stripe recipe (structure — always runs)", () => {
	it("parses cleanly and pins the hasMorePath cursor block", () => {
		// Real loader path — proves the folder-name = slug(shortName) identity
		// (parseApiGuide alone can't see the folder). Scoped to stripe: only
		// assert that stripe loads and is NOT routed malformed; other guides'
		// health is all-guides-parse.test.ts's job, not this file's.
		const loaded = loadApiGuidesFromDir(
			new URL("..", import.meta.url).pathname,
		);
		expect(loaded.guides[DIR]).toBeTruthy();
		expect(loaded.malformed.some((m) => m.filename === DIR)).toBe(false);
		const guide = loaded.guides[DIR]!;
		expect(guide.domains).toContain(DOMAIN);
		expect(guide.auth.kind).toBe("static-key");
		expect(guide.auth.secretRefs).toEqual({
			Authorization: { secret: "restricted_key", prefix: "Bearer " },
		});

		const op = guide.operations.find((o) => o.name === "listCustomers")!;
		expect(op.path).toBe("/v1/customers");
		expect(op.via).toBe("paginate");
		const pag = guide.pagination;
		expect(pag?.style).toBe("cursor");
		expect(pag?.cursorParam).toBe("starting_after");
		expect(pag?.cursorPath).toBe("data[-1].id");
		expect(pag?.hasMorePath).toBe("has_more");
		expect(pag?.itemsPath).toBe("data");
		expect(pag?.pageSizeParam).toBe("limit");
	});

	it("covers the full read-only op set (frozen name list)", () => {
		const loaded = loadApiGuidesFromDir(
			new URL("..", import.meta.url).pathname,
		);
		const guide = loaded.guides[DIR]!;
		const names = [
			// Core
			"listCustomers",
			"listCharges",
			"listPaymentIntents",
			"listSetupIntents",
			"listBalanceTransactions",
			"listPayouts",
			"listRefunds",
			"listDisputes",
			"listEvents",
			"listFiles",
			"listFileLinks",
			// Payment methods
			"listPaymentMethods",
			"listPaymentMethodConfigurations",
			"listPaymentMethodDomains",
			// Products & pricing
			"listProducts",
			"listPrices",
			"listCoupons",
			"listPromotionCodes",
			"listTaxCodes",
			"listTaxRates",
			"listShippingRates",
			// Checkout & payment links
			"listCheckoutSessions",
			"listPaymentLinks",
			// Billing
			"listInvoices",
			"listInvoiceItems",
			"listInvoicePayments",
			"listInvoiceRenderingTemplates",
			"listCreditNotes",
			"listAlerts",
			"listCreditGrants",
			"listMeters",
			"listBillingPortalConfigurations",
			"listPlans",
			"listQuotes",
			"listSubscriptions",
			"listSubscriptionSchedules",
			// Connect
			"listAccounts",
			"listApplicationFees",
			"listCountrySpecs",
			"listTopups",
			"listTransfers",
			// Radar
			"listEarlyFraudWarnings",
			"listValueLists",
			// Terminal
			"listTerminalLocations",
			"listTerminalReaders",
			"listTerminalConfigurations",
			// Identity
			"listIdentityVerificationSessions",
			"listIdentityVerificationReports",
			// Tax
			"listTaxRegistrations",
			"getTaxSettings",
			// Climate
			"listClimateProducts",
			"listClimateOrders",
			"listClimateSuppliers",
			// Reporting
			"listReportTypes",
			// Financial Connections
			"listFinancialConnectionsAccounts",
			// Retrieves
			"getBalance",
			// Nested
			"listSubscriptionItems",
			"listInvoiceLineItems",
			"listCustomerBalanceTransactions",
		];
		expect(names.length).toBe(guide.operations.length);
		expect(new Set(names).size).toBe(names.length);
		for (const name of names) {
			expect(
				guide.operations.some((o) => o.name === name),
				`missing op: ${name}`,
			).toBe(true);
		}
	});

	it("every plain paginate op inherits guide-level pagination; only report_types overrides", () => {
		const loaded = loadApiGuidesFromDir(
			new URL("..", import.meta.url).pathname,
		);
		const guide = loaded.guides[DIR]!;
		for (const op of guide.operations) {
			if (op.via !== "paginate") continue;
			if (op.name === "listReportTypes") {
				// Rejects `limit` live — override WITHOUT pageSizeParam.
				expect(op.pagination).toEqual({
					style: "cursor",
					itemsPath: "data",
					cursorParam: "starting_after",
					cursorPath: "data[-1].id",
					hasMorePath: "has_more",
				});
			} else {
				expect(
					op.pagination,
					`${op.name} must inherit guide pagination`,
				).toBeUndefined();
			}
		}
		// The two retrieves sit outside the pagination machinery entirely.
		for (const name of ["getBalance", "getTaxSettings"]) {
			expect(guide.operations.find((o) => o.name === name)?.via).toBe(
				"restGet",
			);
		}
	});
});

describe("Stripe live integration (authenticated)", () => {
	itWhen(
		"listCustomers fetches a single page with the key injected from the store",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const op = guide.operations.find((o) => o.name === "listCustomers")!;
			const auth = await authFor(guide);
			const result = await paginate(guide.apiHost, op, {}, guide, auth);
			// Single page (no gatherAll): one request, well-formed items.
			expect(result.pages).toBe(1);
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);
			const first = result.items[0] as Record<string, unknown>;
			expect(typeof first["id"]).toBe("string");
		}),
		30_000,
	);

	itWhen(
		"gatherAll walk terminates cleanly via has_more (no ceiling, cursor advances, no overlap)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const op = guide.operations.find((o) => o.name === "listCustomers")!;
			const auth = await authFor(guide);
			const result = await paginate(guide.apiHost, op, {}, guide, {
				...auth,
				gatherAll: true,
			});
			// Clean stop: the done-flag fired, not the ceiling.
			expect(result.ceilingHit).toBe(false);
			expect(result.pages).toBeGreaterThanOrEqual(1);
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);

			// Cursor advance + non-overlap, computed from the walk itself
			// (no hardcoded ids — the account's data is key-specific).
			const pageSize = guide.pagination?.pageSize ?? 10;
			const pageIds: string[][] = [];
			for (let p = 0; p < result.pages; p++) {
				const slice = result.items.slice(
					p * pageSize,
					(p + 1) * pageSize,
				) as Record<string, unknown>[];
				pageIds.push(slice.map((c) => c["id"] as string));
			}
			const seen = new Set<string>();
			for (const ids of pageIds) {
				for (const id of ids) {
					expect(seen.has(id)).toBe(false);
					seen.add(id);
				}
			}
			// Every request after the first carries
			// starting_after = the previous page's last id.
			for (let p = 1; p < pageIds.length; p++) {
				const lastPrev = pageIds[p - 1]![pageIds[p - 1]!.length - 1];
				expect(decodeURIComponent(result.urls[p]!)).toContain(
					`starting_after=${lastPrev}`,
				);
			}
			// The secret never surfaces on any channel.
			for (const url of result.urls) {
				for (const v of auth.secretValues) expect(url).not.toContain(v);
			}
		}),
		60_000,
	);

	// Envelope shape for every top-level (unkeyed) paginate op. Stripe's
	// list envelope is uniform ({object, data, has_more, url}), which is
	// what makes guide-level pagination valid — pin it per op. One `it`
	// per op so a failure names its op; values stay unasserted.
	const { guides: stripeForLoop } = loadApiGuidesFromDir(
		new URL("..", import.meta.url).pathname,
	);
	for (const op of stripeForLoop[DIR]!.operations.filter(isUnkeyedPaginateOp)) {
		itWhen(
			`${op.name} (${op.path}) returns the Stripe list envelope`,
			withTempDirs(DIR)(async ({ guidesDir }) => {
				const { paginate } = await import("pi-lean-host/core/helpers.js");
				const guide = await loadGuide(guidesDir);
				const liveOp = guide.operations.find((o) => o.name === op.name)!;
				const auth = await authFor(guide);
				const result = await paginate(guide.apiHost, liveOp, {}, guide, auth);
				expect(result.pages).toBe(1);
				expect(result.ceilingHit).toBe(false);
				expect(Array.isArray(result.items)).toBe(true);
				const first = result.items[0] as Record<string, unknown> | undefined;
				if (first) {
					expect(typeof first["id"]).toBe("string");
				}
				// The secret never surfaces on the fetched URL(s).
				for (const url of result.urls) {
					for (const v of auth.secretValues) {
						expect(url).not.toContain(v);
					}
				}
			}),
			30_000,
		);
	}

	itWhen(
		"listPaymentMethods drives its required `type` param (default card)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const op = guide.operations.find((o) => o.name === "listPaymentMethods")!;
			const auth = await authFor(guide);
			const result = await paginate(guide.apiHost, op, {}, guide, auth);
			expect(result.pages).toBe(1);
			expect(Array.isArray(result.items)).toBe(true);
			// Every item is a card (the seeded default type), value-agnostically.
			for (const item of result.items as Record<string, unknown>[]) {
				expect(item["type"]).toBe("card");
			}
		}),
		30_000,
	);

	itWhen(
		"listReportTypes pages with the op-level override (no limit param sent)",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const op = guide.operations.find((o) => o.name === "listReportTypes")!;
			const auth = await authFor(guide);
			const result = await paginate(guide.apiHost, op, {}, guide, auth);
			// A 200 here is the proof: with the guide-level `limit` seed this
			// endpoint 400s ("Received unknown parameter: limit").
			expect(result.pages).toBe(1);
			expect(result.ceilingHit).toBe(false);
			expect(Array.isArray(result.items)).toBe(true);
			expect(result.items.length).toBeGreaterThan(0);
		}),
		30_000,
	);

	itWhen(
		"getBalance + getTaxSettings retrieves return their singleton objects",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const { restGet } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const auth = await authFor(guide);
			const balanceRes = await restGet(
				guide.apiHost,
				guide.operations.find((o) => o.name === "getBalance")!,
				{},
				guide,
				auth,
			);
			const balance = balanceRes.data as Record<string, unknown>;
			expect(balance["object"]).toBe("balance");
			expect(Array.isArray(balance["available"])).toBe(true);
			const taxRes = await restGet(
				guide.apiHost,
				guide.operations.find((o) => o.name === "getTaxSettings")!,
				{},
				guide,
				auth,
			);
			expect((taxRes.data as Record<string, unknown>)["object"]).toBe(
				"tax.settings",
			);
		}),
		30_000,
	);

	// ── Nested (foreign-key) ops: id sourced from the parent list, runtime
	// skip when the parent list is empty (fresh test accounts often are).

	itWhen(
		"listSubscriptionItems walks items of the first subscription",
		withTempDirs(DIR)(async ({ guidesDir }, ctx) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const auth = await authFor(guide);
			const parent = guide.operations.find(
				(o) => o.name === "listSubscriptions",
			)!;
			const walk = await paginate(guide.apiHost, parent, {}, guide, auth);
			const subId = (walk.items[0] as Record<string, unknown> | undefined)?.[
				"id"
			] as string | undefined;
			if (!subId) return ctx.skip();
			const op = guide.operations.find(
				(o) => o.name === "listSubscriptionItems",
			)!;
			const result = await paginate(
				guide.apiHost,
				op,
				{ subscription: subId },
				guide,
				auth,
			);
			expect(result.pages).toBeGreaterThanOrEqual(1);
			expect(Array.isArray(result.items)).toBe(true);
		}),
		60_000,
	);

	itWhen(
		"listInvoiceLineItems walks lines of the first invoice",
		withTempDirs(DIR)(async ({ guidesDir }, ctx) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const auth = await authFor(guide);
			const parent = guide.operations.find((o) => o.name === "listInvoices")!;
			const walk = await paginate(guide.apiHost, parent, {}, guide, auth);
			const invoiceId = (
				walk.items[0] as Record<string, unknown> | undefined
			)?.["id"] as string | undefined;
			if (!invoiceId) return ctx.skip();
			const op = guide.operations.find(
				(o) => o.name === "listInvoiceLineItems",
			)!;
			const result = await paginate(
				guide.apiHost,
				op,
				{ invoice: invoiceId },
				guide,
				auth,
			);
			expect(result.pages).toBeGreaterThanOrEqual(1);
			expect(Array.isArray(result.items)).toBe(true);
		}),
		60_000,
	);

	itWhen(
		"listCustomerBalanceTransactions walks the first customer's ledger",
		withTempDirs(DIR)(async ({ guidesDir }, ctx) => {
			const { paginate } = await import("pi-lean-host/core/helpers.js");
			const guide = await loadGuide(guidesDir);
			const auth = await authFor(guide);
			const parent = guide.operations.find((o) => o.name === "listCustomers")!;
			const walk = await paginate(guide.apiHost, parent, {}, guide, auth);
			const customerId = (
				walk.items[0] as Record<string, unknown> | undefined
			)?.["id"] as string | undefined;
			if (!customerId) return ctx.skip();
			const op = guide.operations.find(
				(o) => o.name === "listCustomerBalanceTransactions",
			)!;
			const result = await paginate(
				guide.apiHost,
				op,
				{ customer: customerId },
				guide,
				auth,
			);
			expect(result.pages).toBeGreaterThanOrEqual(1);
			expect(Array.isArray(result.items)).toBe(true);
		}),
		60_000,
	);
});
