import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBackend, loadBackend } from "./backend.server";

const createAppwriteBackend = vi.hoisted(() => vi.fn());
vi.mock("#/server/adapters/appwrite/backend.server", () => ({
	createAppwriteBackend,
}));
vi.mock("#/server/adapters/postgres/backend.server", () => ({
	createPostgresBackendFromEnv: async () => ({ name: "postgres" }),
}));
vi.mock("#/config/env", () => ({ serverEnv: () => ({ BACKEND: "appwrite" }) }));

beforeEach(() => createAppwriteBackend.mockReturnValue({ name: "appwrite" }));

describe("loadBackend", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("loads the Appwrite adapter", async () => {
		await expect(loadBackend("appwrite")).resolves.toEqual({
			name: "appwrite",
		});
	});

	it("loads the postgres adapter", async () => {
		await expect(loadBackend("postgres")).resolves.toEqual({
			name: "postgres",
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

	it("retries the load after a failure", async () => {
		vi.resetModules();
		const { getBackend: fresh } = await import("./backend.server");
		createAppwriteBackend.mockImplementationOnce(() => {
			throw new Error("down");
		});
		await expect(fresh()).rejects.toThrow("down");
		await expect(fresh()).resolves.toEqual({ name: "appwrite" });
	});
});
