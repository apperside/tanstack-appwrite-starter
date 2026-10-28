export type PasswordScore = 0 | 1 | 2 | 3 | 4;

/** Below this length a password scores 0, whatever its variety (the server rejects it). */
const MIN_LENGTH = 8;
const LONG_LENGTH = 12;

/**
 * A cheap, dependency-free strength estimate for the sign-up meter:
 * length ≥ 8 gives 1, ≥ 12 gives +1, and mixed case, a digit and a symbol give +1 each, capped at 4.
 * Guidance only; the server enforces the real policy.
 */
export function scorePassword(password: string): PasswordScore {
	if (password.length < MIN_LENGTH) return 0;
	const points = [
		true,
		password.length >= LONG_LENGTH,
		/\p{Ll}/u.test(password) && /\p{Lu}/u.test(password),
		/\p{N}/u.test(password),
		/[^\p{L}\p{N}]/u.test(password),
	].filter(Boolean).length;
	return Math.min(points, 4) as PasswordScore;
}
