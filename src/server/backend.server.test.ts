import { afterEach, describe, expect, it, vi } from "vitest";
import { loadBackend } from "./backend.server";

vi.mock("#/adapters/appwrite/backend.server", () => ({
	createAppwriteBackend: () => ({ name: "appwrite" }),
}));

describe("loadBackend", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("loads the Appwrite adapter", async () => {
		await expect(loadBackend("appwrite")).resolves.toEqual({
			name: "appwrite",
		});
	});

	it("loads the memory adapter, warning in production", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const dev = await loadBackend("memory");
		expect(dev.data.todos).toBeDefined();
		expect(warn).not.toHaveBeenCalled();
		vi.stubEnv("NODE_ENV", "production");
		await loadBackend("memory");
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining("BACKEND=memory"),
		);
		warn.mockRestore();
	});
});
