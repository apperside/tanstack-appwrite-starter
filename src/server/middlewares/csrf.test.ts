import { describe, expect, it, vi } from "vitest";
import { csrfMiddleware } from "./csrf";

vi.mock("#/config/env", () => ({
	serverEnv: () => ({ APP_URL: "https://app.test/" }),
}));

type Server = (ctx: unknown) => Promise<unknown> | unknown;
const server = csrfMiddleware.options.server as unknown as Server;
const NEXT = { passed: true };

/** Runs the middleware; the request URL is the proxy's view, not the public one. */
async function run(
	headers: Record<string, string>,
	handlerType: "serverFn" | "router" = "serverFn",
) {
	const result = await server({
		request: new Request("http://internal:3000/_serverFn/x", {
			method: "POST",
			headers,
		}),
		handlerType,
		next: () => NEXT,
	});
	return result === NEXT ? "passed" : (result as Response).status;
}

describe("csrfMiddleware", () => {
	it("lets a same-origin server-function call through", async () => {
		expect(await run({ "sec-fetch-site": "same-origin" })).toBe("passed");
	});

	it.each([
		"same-site",
		"cross-site",
		"none",
	])("refuses Sec-Fetch-Site %s with 403", async (site) => {
		expect(await run({ "sec-fetch-site": site })).toBe(403);
	});

	it("falls back to Origin, matched against APP_URL", async () => {
		expect(await run({ origin: "https://app.test" })).toBe("passed");
		expect(await run({ origin: "https://evil.app.test" })).toBe(403);
		expect(await run({ origin: "http://app.test" })).toBe(403);
	});

	it("falls back to Referer without Origin", async () => {
		expect(await run({ referer: "https://app.test/login" })).toBe("passed");
		expect(await run({ referer: "https://evil.test/" })).toBe(403);
	});

	it("refuses a call with no origin information", async () => {
		expect(await run({})).toBe(403);
	});

	it("leaves page requests alone", async () => {
		expect(await run({ "sec-fetch-site": "cross-site" }, "router")).toBe(
			"passed",
		);
	});
});
