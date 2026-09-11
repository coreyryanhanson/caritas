/**
 * Telegram Bot API recipe validity tests — endpoint coverage + live fetch sanity.
 *
 * The Telegram pattern keys auth through the URL path (`/bot<token>/<method>`).
 * These tests verify the path-secret surface end-to-end: the stored
 * `bot_token` resolves via `resolveSecretPathParams`, fills `{token}` at
 * fetch time through the canonical `resolveOpForExecution` pipeline, and is
 * redacted from every surfaced URL (raw + both hex forms).
 *
 * Coverage follows `endpoint-coverage-plan.md`: all 30 read-only methods.
 * 24 assert a successful `{ok: true, result: ...}` envelope; 6 are
 * entitlement/data-gated and assert the documented `ok:false` error
 * envelope instead (see the plan's "Verification data plan").
 *
 * Skipped in bare CI — opt in via HOST_INTEGRATION=1. Requires a provisioned
 * bot token at `/api secrets telegram.org` (name: `bot_token`).
 */

import { readFileSync } from "node:fs";
import type { RestGetResult } from "pi-lean-host/core/helpers.js";
import { parseApiGuide } from "pi-lean-host/core/parse-api-guide.js";
import { describe, expect, it } from "vitest";
import {
	createResolveOpFn,
	itWhen,
	withTempDirs,
} from "../_shared/test-harness.js";

const DIR = "telegram-bot-api";
const DOMAIN = "telegram.org";
const OWNER_ID = "417885870";
const GROUP_ID = "-5426790920";
const BOT_ID = 8629502301;
const STICKER_SET = "UtyaDuck";
// Custom-emoji ID harvested once from getForumTopicIconStickers (a stable
// official set — the "Topics" topic-icon set).
const EMOJI_IDS = '["5434144690511290129"]';

// All 30 read-only methods, per the coverage plan.
const ALL_OPS = [
	"getUpdates",
	"getWebhookInfo",
	"getMe",
	"getUserProfilePhotos",
	"getUserProfileAudios",
	"getFile",
	"getChat",
	"getChatAdministrators",
	"getChatMemberCount",
	"getChatMember",
	"getUserPersonalChatMessages",
	"getForumTopicIconStickers",
	"getUserChatBoosts",
	"getBusinessConnection",
	"getManagedBotAccessSettings",
	"getMyCommands",
	"getMyName",
	"getMyDescription",
	"getMyShortDescription",
	"getChatMenuButton",
	"getMyDefaultAdministratorRights",
	"getAvailableGifts",
	"getBusinessAccountStarBalance",
	"getBusinessAccountGifts",
	"getUserGifts",
	"getChatGifts",
	"getStickerSet",
	"getCustomEmojiStickers",
	"getMyStarBalance",
	"getStarTransactions",
];

/** Envelope every Bot API response shares. */
interface TgEnvelope {
	ok: boolean;
	result?: unknown;
}

/** Successful pipeline run: the redacted surfaced URL + the parsed envelope. */
interface TgRun {
	url: string;
	data: TgEnvelope;
}

/** Every op in this guide is restGet — the run wrapper can assume the shape. */
function asRestGet(result: RestGetResult | unknown): RestGetResult {
	return result as RestGetResult;
}

/** The canonical resolve-op pipeline, pinned to this guide's domain. */
const runResolveOp = createResolveOpFn(DOMAIN);

/** Run one op; throws on pipeline rejection or HTTP >= 400 HelperError. */
async function runOp(
	guidesDir: string,
	name: string,
	params: Record<string, unknown> = {},
): Promise<TgRun> {
	const r = asRestGet(await runResolveOp(guidesDir, name, params));
	return { url: r.url, data: r.data as TgEnvelope };
}

/** Run one op expected to fail with a documented Telegram `ok:false` envelope. */
async function runOpExpectError(
	guidesDir: string,
	name: string,
	params: Record<string, unknown> = {},
): Promise<Error & { url?: string }> {
	try {
		await runOp(guidesDir, name, params);
	} catch (err) {
		return err as Error & { url?: string };
	}
	throw new Error(`${name} should have failed with an HTTP 400 envelope`);
}

/** The raw token, for not-to-contain assertions (never printed). */
async function rawToken(guidesDir: string): Promise<string> {
	const { resolveSecretPathParams } = await import("pi-lean-host/core/auth.js");
	const { setUserGuidesDir, findGuidesByDomain } = await import(
		"pi-lean-host/core/guide-store.js"
	);
	setUserGuidesDir(guidesDir);
	const { guide } = findGuidesByDomain(DOMAIN).find(({ guide }) =>
		guide.operations.some((o) => o.name === "getMe"),
	)!;
	if (guide.auth.kind !== "static-key") throw new Error("static-key expected");
	const res = resolveSecretPathParams(guide.auth, DOMAIN);
	expect(res.missing).toEqual([]);
	return res.values["token"]!;
}

function expectRedacted(url: string, token: string): void {
	expect(url).toContain("/bot***/");
	expect(url).not.toContain(token);
	// The URL-encoded forms must be gone too (a 400 body/echo surfacing the
	// token inside an encoded URL string is the likeliest leak shape).
	expect(url).not.toContain(encodeURIComponent(token));
	expect(url).not.toContain(
		encodeURIComponent(token).replace(/%../g, (s) => s.toLowerCase()),
	);
}

function expectOk(url: string, token: string, data: TgEnvelope): void {
	expectRedacted(url, token);
	expect(data.ok).toBe(true);
	expect(data.result).toBeDefined();
}

describe("Telegram Bot API recipe", () => {
	it("parses cleanly and covers all 30 read-only methods (no network)", () => {
		const raw = readFileSync(`${import.meta.dirname}/guide.md`, "utf-8");
		const result = parseApiGuide(raw, {
			file: "guide.md",
			filename: DOMAIN,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const guide = result.guide;
		expect(guide.apiHost).toBe("https://api.telegram.org");
		expect(guide.auth.kind).toBe("static-key");
		if (guide.auth.kind !== "static-key") return;
		expect(guide.auth.secretPathRefs).toEqual({
			token: { secret: "bot_token" },
		});
		expect(guide.auth.secretRefs).toBeUndefined();
		expect(guide.auth.secretQueryRefs).toBeUndefined();

		expect(guide.operations.length).toBe(30);
		const names = new Set(guide.operations.map((o) => o.name));
		for (const expected of ALL_OPS) {
			expect(names.has(expected)).toBe(true);
		}
		// Every op is a path-keyed restGet; the token is store-owned and
		// never agent-suppliable.
		for (const op of guide.operations) {
			expect(op.via).toBe("restGet");
			expect(op.path.startsWith("/bot{token}/")).toBe(true);
			expect(op.pathParams).toEqual(["token"]);
			expect(op.params["token"]).toBeUndefined();
		}
	});

	itWhen(
		"update methods: getUpdates + getWebhookInfo return the ok envelope",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const token = await rawToken(guidesDir);

			const u = await runOp(guidesDir, "getUpdates");
			expectOk(u.url, token, u.data);
			expect(Array.isArray(u.data.result)).toBe(true);

			const w = await runOp(guidesDir, "getWebhookInfo");
			expectOk(w.url, token, w.data);
			expect(w.data.result).toHaveProperty("url");
		}),
		30_000,
	);

	itWhen(
		"user + chat introspection methods return the ok envelope",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const token = await rawToken(guidesDir);

			const me = await runOp(guidesDir, "getMe");
			expectOk(me.url, token, me.data);
			expect((me.data.result as Record<string, unknown>)["id"]).toBe(BOT_ID);

			for (const [name, params] of [
				["getUserProfilePhotos", { user_id: OWNER_ID }],
				["getUserProfileAudios", { user_id: OWNER_ID }],
				["getChat", { chat_id: GROUP_ID }],
				["getChatAdministrators", { chat_id: GROUP_ID }],
				["getChatMemberCount", { chat_id: GROUP_ID }],
				["getChatMember", { chat_id: GROUP_ID, user_id: OWNER_ID }],
				["getUserGifts", { user_id: OWNER_ID }],
				["getChatGifts", { chat_id: GROUP_ID }],
			] as const) {
				const r = await runOp(guidesDir, name, { ...params });
				expectOk(r.url, token, r.data);
			}

			const count = await runOp(guidesDir, "getChatMemberCount", {
				chat_id: GROUP_ID,
			});
			expect(count.data.result).toBe(2);

			const admins = await runOp(guidesDir, "getChatAdministrators", {
				chat_id: GROUP_ID,
			});
			expect((admins.data.result as unknown[]).length).toBeGreaterThan(0);
		}),
		60_000,
	);

	itWhen(
		"getFile resolves a live sticker file_id; sticker + emoji reads return the ok envelope",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const token = await rawToken(guidesDir);

			const ss = await runOp(guidesDir, "getStickerSet", {
				name: STICKER_SET,
			});
			expectOk(ss.url, token, ss.data);
			const stickers = (ss.data.result as { stickers: { file_id: string }[] })
				.stickers;
			expect(stickers.length).toBeGreaterThan(0);
			// Harvest the file_id from the live set response — no pinned constant
			// to go stale. (verify.json carries a pinned one for /api verify.)
			const fileId = stickers[0]!.file_id;

			const f = await runOp(guidesDir, "getFile", { file_id: fileId });
			expectOk(f.url, token, f.data);
			expect(f.data.result).toHaveProperty("file_path");

			const ce = await runOp(guidesDir, "getCustomEmojiStickers", {
				custom_emoji_ids: EMOJI_IDS,
			});
			expectOk(ce.url, token, ce.data);
			expect((ce.data.result as unknown[]).length).toBe(1);
		}),
		60_000,
	);

	itWhen(
		"bot configuration reads return the ok envelope",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const token = await rawToken(guidesDir);
			for (const name of [
				"getForumTopicIconStickers",
				"getMyCommands",
				"getMyName",
				"getMyDescription",
				"getMyShortDescription",
				"getChatMenuButton",
				"getMyDefaultAdministratorRights",
				"getAvailableGifts",
				"getMyStarBalance",
				"getStarTransactions",
			]) {
				const r = await runOp(guidesDir, name);
				expectOk(r.url, token, r.data);
			}
		}),
		60_000,
	);

	itWhen(
		"entitlement-gated ops surface the documented ok:false envelope, token still redacted",
		withTempDirs(DIR)(async ({ guidesDir }) => {
			const token = await rawToken(guidesDir);
			// These are data/entitlement-gated for this bot (see the coverage
			// plan): no personal channel on the profile, boosts don't apply to
			// basic groups, no business connection, no managed bots. Telegram
			// answers HTTP 400 with a documented description — the HelperError
			// must carry the redacted URL and the scrubbed body excerpt.
			const cases = [
				{
					name: "getUserPersonalChatMessages",
					params: { user_id: OWNER_ID, limit: "1" },
					description: "USER_PERSONAL_CHANNEL_MISSING",
				},
				{
					name: "getUserChatBoosts",
					params: { chat_id: GROUP_ID, user_id: OWNER_ID },
					description: "PEER_ID_INVALID",
				},
				{
					name: "getBusinessConnection",
					params: { business_connection_id: "placeholder" },
					description: "business connection not found",
				},
				{
					name: "getBusinessAccountStarBalance",
					params: { business_connection_id: "placeholder" },
					description: "business connection not found",
				},
				{
					name: "getBusinessAccountGifts",
					params: { business_connection_id: "placeholder" },
					description: "business connection not found",
				},
				{
					name: "getManagedBotAccessSettings",
					params: { user_id: String(BOT_ID) },
					description: "BOT_ACCESS_FORBIDDEN",
				},
			] as const;
			for (const c of cases) {
				const err = await runOpExpectError(guidesDir, c.name, { ...c.params });
				expect(err.name).toBe("HelperError");
				expect(err.message).toContain(c.description);
				expect(err.url).toBeDefined();
				expectRedacted(err.url!, token);
			}
		}),
		60_000,
	);
});
