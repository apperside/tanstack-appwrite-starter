import { describe, expect, it } from "vitest";
import { AppError } from "#/lib/errors";
import {
	AUTH_RATE_LIMITS,
	createRateLimiter,
	rateLimit,
} from "./rate-limit.server";

function clock(start = 1_000) {
	let t = start;
	return {
		now: () => t,
		advance: (ms: number) => {
			t += ms;
		},
	};
}

describe("createRateLimiter", () => {
	it("allows `limit` hits then blocks with a retry delay", () => {
		const c = clock();
		const limiter = createRateLimiter({ limit: 5, windowMs: 1000, now: c.now });
		for (let i = 0; i < 5; i++) expect(limiter.hit("k").allowed).toBe(true);
		const blocked = limiter.hit("k");
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfterMs).toBeGreaterThan(0);
	});

	it("allows again once the window has passed", () => {
		const c = clock();
		const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
		limiter.hit("k");
		expect(limiter.hit("k").allowed).toBe(false);
		c.advance(1000);
		expect(limiter.hit("k").allowed).toBe(true);
	});

	it("reports the time until the oldest hit expires", () => {
		const c = clock();
		const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
		limiter.hit("k");
		c.advance(300);
		expect(limiter.hit("k").retryAfterMs).toBe(700);
	});

	it("keeps keys independent", () => {
		const c = clock();
		const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
		limiter.hit("a");
		expect(limiter.hit("a").allowed).toBe(false);
		expect(limiter.hit("b").allowed).toBe(true);
	});

	it("does not count blocked hits against the window", () => {
		const c = clock();
		const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
		limiter.hit("k");
		c.advance(500);
		limiter.hit("k");
		c.advance(500);
		expect(limiter.hit("k").allowed).toBe(true);
	});

	it("keeps keys that still have hits in the window when sweeping", () => {
		const c = clock();
		const limiter = createRateLimiter({ limit: 2, windowMs: 1000, now: c.now });
		limiter.hit("a");
		c.advance(600);
		limiter.hit("a");
		c.advance(400);
		limiter.hit("b");
		expect(limiter.size()).toBe(2);
		expect(limiter.hit("a").allowed).toBe(true);
	});

	it("drops idle keys so memory does not grow", () => {
		const c = clock();
		const limiter = createRateLimiter({ limit: 1, windowMs: 1000, now: c.now });
		limiter.hit("a");
		limiter.hit("b");
		c.advance(1000);
		limiter.hit("c");
		expect(limiter.size()).toBe(1);
	});
});

describe("rateLimit", () => {
	it("throws RATE_LIMITED once a bucket is exhausted", () => {
		const { limit } = AUTH_RATE_LIMITS.signInEmail;
		for (let i = 0; i < limit; i++) rateLimit("signInEmail", "ip|a@b.c");
		expect(() => rateLimit("signInEmail", "ip|a@b.c")).toThrow(AppError);
		expect(() => rateLimit("signInEmail", "ip|a@b.c")).toThrow("RATE_LIMITED");
		expect(() => rateLimit("signInEmail", "other")).not.toThrow();
	});

	it("matches the specified limits", () => {
		const m = 60_000;
		expect(AUTH_RATE_LIMITS).toEqual({
			signIn: { limit: 20, windowMs: 15 * m },
			signInEmail: { limit: 5, windowMs: 15 * m },
			signUp: { limit: 5, windowMs: 60 * m },
			guest: { limit: 10, windowMs: 60 * m },
			passwordReset: { limit: 5, windowMs: 60 * m },
			passwordResetIp: { limit: 20, windowMs: 60 * m },
		});
	});
});
