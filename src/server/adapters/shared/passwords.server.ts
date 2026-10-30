import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
	password: string,
	salt: Buffer,
	keylen: number,
	options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const KEY_LENGTH = 32;

export type ScryptCost = { N: number; r: number; p: number };

/** The OWASP-recommended scrypt cost, for backends that hold real accounts. */
export const OWASP_SCRYPT: ScryptCost = { N: 2 ** 17, r: 8, p: 1 };

/** A cheap scrypt cost for development and tests. */
export const LOW_SCRYPT: ScryptCost = { N: 1024, r: 8, p: 1 };

const derive = (
	password: string,
	salt: Buffer,
	{ N, r, p }: ScryptCost,
): Promise<Buffer> =>
	// scrypt needs 128 * N * r bytes; the 32 MiB default is too low for N = 2^17.
	scryptAsync(password, salt, KEY_LENGTH, { N, r, p, maxmem: 256 * N * r });

/** `scrypt$N$r$p$<salt>$<hash>`: the cost travels with the hash. */
export async function hashPassword(
	password: string,
	cost: ScryptCost,
): Promise<string> {
	const salt = randomBytes(16);
	const hash = await derive(password, salt, cost);
	const { N, r, p } = cost;
	return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Whether `password` matches `stored`; false for a missing or malformed hash. */
export async function verifyPassword(
	password: string,
	stored: string | null,
): Promise<boolean> {
	const [scheme, n, r, p, salt, hash] = stored?.split("$") ?? [];
	const cost = { N: Number(n), r: Number(r), p: Number(p) };
	if (
		scheme !== "scrypt" ||
		!salt ||
		!hash ||
		!Object.values(cost).every(Number.isSafeInteger)
	) {
		return false;
	}
	const expected = Buffer.from(hash, "base64");
	try {
		const actual = await derive(password, Buffer.from(salt, "base64"), cost);
		return (
			actual.length === expected.length && timingSafeEqual(actual, expected)
		);
	} catch {
		// Parameters scrypt rejects (e.g. N not a power of two).
		return false;
	}
}
