import { describe, expect, it } from "vitest";
import { resolveClientIp } from "./client-ip.server";

const socketIp = "10.0.0.1";

describe("resolveClientIp", () => {
	it("ignores X-Forwarded-For with no trusted proxies", () => {
		expect(
			resolveClientIp({
				socketIp,
				forwardedFor: "6.6.6.6",
				trustedProxyHops: 0,
			}),
		).toBe(socketIp);
	});

	it("returns `unknown` without any address", () => {
		expect(
			resolveClientIp({
				socketIp: undefined,
				forwardedFor: undefined,
				trustedProxyHops: 0,
			}),
		).toBe("unknown");
	});

	it("uses the rightmost entry behind one proxy, ignoring a spoofed prefix", () => {
		expect(
			resolveClientIp({
				socketIp,
				forwardedFor: "6.6.6.6, 203.0.113.7",
				trustedProxyHops: 1,
			}),
		).toBe("203.0.113.7");
	});

	it("uses the second entry from the right behind two proxies", () => {
		expect(
			resolveClientIp({
				socketIp,
				forwardedFor: "6.6.6.6, 203.0.113.7, 172.16.0.2",
				trustedProxyHops: 2,
			}),
		).toBe("203.0.113.7");
	});

	it("falls back to the socket address when the header is short or missing", () => {
		expect(
			resolveClientIp({
				socketIp,
				forwardedFor: "1.1.1.1",
				trustedProxyHops: 2,
			}),
		).toBe(socketIp);
		expect(
			resolveClientIp({
				socketIp,
				forwardedFor: undefined,
				trustedProxyHops: 1,
			}),
		).toBe(socketIp);
	});

	it("trims whitespace and falls back on an empty entry", () => {
		expect(
			resolveClientIp({
				socketIp,
				forwardedFor: "  1.1.1.1 ,   203.0.113.7  ",
				trustedProxyHops: 1,
			}),
		).toBe("203.0.113.7");
		expect(
			resolveClientIp({
				socketIp,
				forwardedFor: "1.1.1.1,",
				trustedProxyHops: 1,
			}),
		).toBe(socketIp);
	});
});
