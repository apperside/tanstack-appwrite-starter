type ClientIpInput = {
	/** Address of the TCP peer, if known. */
	socketIp: string | undefined;
	/** Raw `X-Forwarded-For` header, if any. */
	forwardedFor: string | undefined;
	/** Number of trusted reverse proxies that each append one hop to the header. */
	trustedProxyHops: number;
};

/**
 * `X-Forwarded-For` is client-controlled; only entries appended by our own
 * proxies can be trusted. Each trusted proxy appends the address it saw, so the
 * client is the Nth entry from the right. With no trusted proxies the header is
 * ignored and the socket address is used.
 */
export function resolveClientIp({
	socketIp,
	forwardedFor,
	trustedProxyHops,
}: ClientIpInput): string {
	const fallback = socketIp ?? "unknown";
	if (trustedProxyHops <= 0 || !forwardedFor) return fallback;
	const entries = forwardedFor.split(",").map((entry) => entry.trim());
	return entries.at(-trustedProxyHops) || fallback;
}
