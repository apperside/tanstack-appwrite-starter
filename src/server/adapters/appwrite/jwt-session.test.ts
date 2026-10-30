import { describe, expect, it, vi } from "vitest";
import { createJwtSession } from "./jwt-session";

function setup(maxAgeMs?: number) {
	let time = 1_000;
	let counter = 0;
	const issueJwt = vi.fn(async () => `jwt-${++counter}`);
	const session = createJwtSession({ issueJwt, maxAgeMs, now: () => time });
	return {
		session,
		issueJwt,
		advance: (ms: number) => {
			time += ms;
		},
	};
}

describe("createJwtSession", () => {
	it("issues once for concurrent callers", async () => {
		const { session, issueJwt } = setup();
		const [a, b] = await Promise.all([session.getJwt(), session.getJwt()]);
		expect(a).toBe("jwt-1");
		expect(b).toBe("jwt-1");
		expect(issueJwt).toHaveBeenCalledTimes(1);
	});

	it("reuses the JWT until maxAgeMs has passed, then issues again", async () => {
		const { session, issueJwt, advance } = setup(1_000);
		await session.getJwt();
		advance(999);
		await expect(session.getJwt()).resolves.toBe("jwt-1");
		advance(1);
		await expect(session.getJwt()).resolves.toBe("jwt-2");
		expect(issueJwt).toHaveBeenCalledTimes(2);
	});

	it("defaults to a ten minute lifetime", async () => {
		const { session, issueJwt, advance } = setup();
		await session.getJwt();
		advance(10 * 60_000 - 1);
		await session.getJwt();
		expect(issueJwt).toHaveBeenCalledTimes(1);
		advance(1);
		await session.getJwt();
		expect(issueJwt).toHaveBeenCalledTimes(2);
	});

	it("issues a new JWT after invalidate()", async () => {
		const { session } = setup();
		await session.getJwt();
		session.invalidate();
		await expect(session.getJwt()).resolves.toBe("jwt-2");
	});

	it("does not cache a failed issue", async () => {
		const issueJwt = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce("ok");
		const session = createJwtSession({ issueJwt });
		await expect(session.getJwt()).rejects.toThrow("boom");
		await expect(session.getJwt()).resolves.toBe("ok");
	});
});
