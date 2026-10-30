import { afterEach, describe, expect, it, vi } from "vitest";
import { getBackend, loadBackend } from "./backend.server";

vi.mock("#/server/adapters/appwrite/backend.server", () => ({
	createAppwriteBackend: () => ({ name: "appwrite" }),
}));
vi.mock("#/config/env", () => ({ serverEnv: () => ({ BACKEND: "appwrite" }) }));

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

describe("getBackend", () => {
	it("loads the adapter named by BACKEND once, shared by every request", async () => {
		const first = getBackend();
		expect(getBackend()).toBe(first);
		await expect(first).resolves.toEqual({ name: "appwrite" });
	});
});
