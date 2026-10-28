import { AppError } from "#/lib/errors";
import type { RateLimitBucket } from "./context";

type RateLimiterOptions = {
	limit: number;
	windowMs: number;
	/** Injectable clock for tests. */
	now?: () => number;
};

/** In-memory sliding window; per process, so it limits each server instance on its own. */
export function createRateLimiter({
	limit,
	windowMs,
	now = Date.now,
}: RateLimiterOptions) {
	const hits = new Map<string, number[]>();
	let lastSweep = now();

	/** Drops keys with no hit left in the window; at most once per window. */
	function sweep(t: number) {
		if (t - lastSweep < windowMs) return;
		lastSweep = t;
		for (const [key, times] of hits) {
			if (times.every((at) => t - at >= windowMs)) hits.delete(key);
		}
	}

	return {
		hit(key: string): { allowed: boolean; retryAfterMs: number } {
			const t = now();
			sweep(t);
			const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
			const allowed = recent.length < limit;
			if (allowed) recent.push(t);
			hits.set(key, recent);
			return {
				allowed,
				retryAfterMs: allowed ? 0 : (recent[0] as number) + windowMs - t,
			};
		},
		/** Number of tracked keys. */
		size: () => hits.size,
	};
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const AUTH_RATE_LIMITS: Record<
	RateLimitBucket,
	{ limit: number; windowMs: number }
> = {
	signIn: { limit: 20, windowMs: 15 * MINUTE }, // per IP
	signInEmail: { limit: 5, windowMs: 15 * MINUTE }, // per IP + email
	signUp: { limit: 5, windowMs: HOUR }, // per IP
	guest: { limit: 10, windowMs: HOUR }, // per IP
	passwordReset: { limit: 5, windowMs: HOUR }, // per IP + email
	// Per IP, across emails: caps the recovery emails one IP can trigger (and
	// the per-email keys it can create); roomy enough for a shared NAT.
	passwordResetIp: { limit: 20, windowMs: HOUR },
};

const limiters = Object.fromEntries(
	Object.entries(AUTH_RATE_LIMITS).map(([bucket, options]) => [
		bucket,
		createRateLimiter(options),
	]),
) as Record<RateLimitBucket, ReturnType<typeof createRateLimiter>>;

/** Throws `AppError("RATE_LIMITED")` once `key` exceeds the bucket's limit. */
export function rateLimit(bucket: RateLimitBucket, key: string): void {
	if (!limiters[bucket].hit(key).allowed) throw new AppError("RATE_LIMITED");
}
