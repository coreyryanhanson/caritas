import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["api-guides/**/*.test.ts", "__tests__/**/*.test.ts"],
		passWithNoTests: true,
		testTimeout: 15_000,
	},
});
