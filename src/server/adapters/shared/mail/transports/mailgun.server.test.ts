import { describe, expect, it, vi } from "vitest";
import { createMailgunTransport, parseMailgunEnv } from "./mailgun.server";

const message = {
	from: "App <no-reply@example.test>",
	to: "ann@example.test",
	subject: "Hi",
	text: "plain",
	html: "<p>html</p>",
};
const base = { MAILGUN_API_KEY: "key-1", MAILGUN_DOMAIN: "mg.example.com" };

function setup(raw: Record<string, unknown>, status = 200) {
	const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status }));
	const transport = createMailgunTransport(
		parseMailgunEnv(raw),
		fetchImpl as never,
	);
	return { fetchImpl, transport };
}

describe("parseMailgunEnv", () => {
	it("needs a key and a domain", () => {
		expect(() => parseMailgunEnv({})).toThrow(
			/MAILGUN_API_KEY.*MAILGUN_DOMAIN/,
		);
		expect(() => parseMailgunEnv({ ...base, MAILGUN_REGION: "asia" })).toThrow(
			/MAILGUN_REGION/,
		);
	});
});

describe("parseMailgunEnv blanks", () => {
	it("reads a blank MAILGUN_REGION as the default", () => {
		const env = parseMailgunEnv({
			MAILGUN_API_KEY: "k",
			MAILGUN_DOMAIN: "d",
			MAILGUN_REGION: "",
		});
		expect(env.MAILGUN_REGION).toBe("us");
	});
});

describe("createMailgunTransport", () => {
	it("posts to the US API by default", async () => {
		const { fetchImpl, transport } = setup(base);
		await transport.send(message);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		const [url, init] = fetchImpl.mock.calls[0] ?? [];
		expect(url).toBe("https://api.mailgun.net/v3/mg.example.com/messages");
		expect(init.method).toBe("POST");
		expect(init.headers).toEqual({
			Authorization: `Basic ${btoa("api:key-1")}`,
		});
		expect(init.body).toBeInstanceOf(URLSearchParams);
		expect(Object.fromEntries(init.body)).toEqual(message);
	});

	it("posts to the EU API when MAILGUN_REGION=eu", async () => {
		const { fetchImpl, transport } = setup({ ...base, MAILGUN_REGION: "eu" });
		await transport.send(message);
		expect(fetchImpl.mock.calls[0]?.[0]).toMatch(
			/^https:\/\/api\.eu\.mailgun\.net\//,
		);
	});

	it("rejects a non-2xx response with the status, never the key", async () => {
		const { transport } = setup(base, 401);
		const error = await transport.send(message).catch((e: Error) => e);
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toContain("401");
		expect((error as Error).message).not.toContain("key-1");
	});
});
