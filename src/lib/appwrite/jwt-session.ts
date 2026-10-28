type JwtSessionOptions = {
	issueJwt: () => Promise<string>;
	/** Appwrite JWTs live 15 minutes; renew well before. */
	maxAgeMs?: number;
	now?: () => number;
};

/** Caches one JWT and shares the in-flight request between concurrent callers. */
export function createJwtSession({
	issueJwt,
	maxAgeMs = 10 * 60_000,
	now = Date.now,
}: JwtSessionOptions) {
	let current: { jwt: Promise<string>; issuedAt: number } | undefined;

	return {
		getJwt(): Promise<string> {
			if (current && now() - current.issuedAt < maxAgeMs) return current.jwt;
			const entry = { jwt: issueJwt(), issuedAt: now() };
			current = entry;
			// A failed issue must not be cached.
			entry.jwt.catch(() => {
				if (current === entry) current = undefined;
			});
			return entry.jwt;
		},
		invalidate(): void {
			current = undefined;
		},
	};
}
