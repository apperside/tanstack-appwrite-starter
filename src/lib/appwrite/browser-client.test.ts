import { AppwriteException, type Client } from "appwrite";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "#/lib/errors";
import { createBrowserRunner, withBrowserClient } from "./browser-client";

const issueBrowserJwt = vi.hoisted(() => vi.fn());
vi.mock("#/features/auth/auth.functions", () => ({ issueBrowserJwt }));

const unauthorized = () =>
	new AppwriteException("unauthorized", 401, "user_jwt_invalid");

function setup() {
	let counter = 0;
	const issueJwt = vi.fn(async () => `jwt-${++counter}`);
	const run = createBrowserRunner({ issueJwt });
	return { run, issueJwt };
}

describe("createBrowserRunner", () => {
	it("creates nothing until the first call", () => {
		const { issueJwt } = setup();
		expect(issueJwt).not.toHaveBeenCalled();
	});

	it("authenticates one shared client with the issued JWT", async () => {
		const { run, issueJwt } = setup();
		const seen = await run(async (c) => c);
		const again = await run(async (c) => c);
		expect(seen.client).toBe(again.client);
		expect(seen.account).toBeDefined();
		expect(seen.tables.typed).toBeDefined();
		expect(issueJwt).toHaveBeenCalledTimes(1);
		expect(seen.client.headers["X-Appwrite-JWT"]).toBe("jwt-1");
	});

	it("retries exactly once with a fresh JWT after a 401", async () => {
		const { run, issueJwt } = setup();
		const attempt = vi
			.fn<(c: { client: Client }) => Promise<string>>()
			.mockRejectedValueOnce(unauthorized())
			.mockImplementationOnce(
				async (c) => c.client.headers["X-Appwrite-JWT"] as string,
			);
		await expect(run(attempt)).resolves.toBe("jwt-2");
		expect(attempt).toHaveBeenCalledTimes(2);
		expect(issueJwt).toHaveBeenCalledTimes(2);
	});

	it("rethrows a second 401 as UNAUTHENTICATED", async () => {
		const { run } = setup();
		const attempt = vi.fn().mockRejectedValue(unauthorized());
		await expect(run(attempt)).rejects.toEqual(new AppError("UNAUTHENTICATED"));
		expect(attempt).toHaveBeenCalledTimes(2);
	});

	it("rethrows a non-401 error from the retry unchanged", async () => {
		const { run } = setup();
		const failure = new AppwriteException("nope", 404, "row_not_found");
		const attempt = vi
			.fn()
			.mockRejectedValueOnce(unauthorized())
			.mockRejectedValueOnce(failure);
		await expect(run(attempt)).rejects.toBe(failure);
	});

	it("does not retry other errors", async () => {
		const { run, issueJwt } = setup();
		const failure = new AppwriteException("nope", 404, "row_not_found");
		const attempt = vi.fn().mockRejectedValue(failure);
		await expect(run(attempt)).rejects.toBe(failure);
		expect(attempt).toHaveBeenCalledTimes(1);
		expect(issueJwt).toHaveBeenCalledTimes(1);
	});
});

describe("withBrowserClient", () => {
	it("refuses to run during SSR", () => {
		vi.stubEnv("SSR", true);
		try {
			expect(() => withBrowserClient(async () => 1)).toThrow(
				"withBrowserClient is browser-only",
			);
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("issues the JWT through the issueBrowserJwt server function", async () => {
		vi.stubEnv("SSR", false);
		issueBrowserJwt.mockResolvedValue({ jwt: "from-server" });
		const header = await withBrowserClient(
			async (c) => c.client.headers["X-Appwrite-JWT"],
		).finally(() => vi.unstubAllEnvs());
		expect(header).toBe("from-server");
		expect(issueBrowserJwt).toHaveBeenCalledTimes(1);
	});
});
