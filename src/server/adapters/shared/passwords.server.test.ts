import { describe, expect, it } from "vitest";
import {
	hashPassword,
	LOW_SCRYPT,
	OWASP_SCRYPT,
	verifyPassword,
} from "./passwords.server";

describe("passwords", () => {
	it("hashes in the versioned scrypt format", async () => {
		expect(await hashPassword("pw", LOW_SCRYPT)).toMatch(
			/^scrypt\$1024\$8\$1\$[^$]+\$[^$]+$/,
		);
	});

	it("verifies with the cost stored in the hash", async () => {
		const stored = await hashPassword("pw", { N: 2048, r: 8, p: 1 });
		expect(await verifyPassword("pw", stored)).toBe(true);
		expect(await verifyPassword("px", stored)).toBe(false);
	});

	it("salts every hash", async () => {
		expect(await hashPassword("pw", LOW_SCRYPT)).not.toBe(
			await hashPassword("pw", LOW_SCRYPT),
		);
	});

	it("refuses null and malformed hashes", async () => {
		for (const stored of [null, "garbage", "scrypt$x$8$1$a$b"]) {
			expect(await verifyPassword("pw", stored)).toBe(false);
		}
	});

	it("recommends OWASP cost", () => {
		expect(OWASP_SCRYPT).toEqual({ N: 131072, r: 8, p: 1 });
	});
});
