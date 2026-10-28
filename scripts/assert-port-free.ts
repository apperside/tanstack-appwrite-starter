/**
 * Exits non-zero when a TCP port is already taken, so `pnpm lighthouse` never
 * audits a stale server left on its fixed port (see lighthouserc.yml).
 *
 * Usage: node scripts/assert-port-free.ts <port>
 */
import { createServer } from "node:net";

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port <= 0) {
	console.error("Usage: node scripts/assert-port-free.ts <port>");
	process.exit(2);
}

/** Rejects when `host:port` cannot be bound (another server holds it). */
function bind(host: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.once("error", reject);
		probe.listen({ port, host, exclusive: true }, () =>
			probe.close(() => resolve()),
		);
	});
}

try {
	// Both stacks: a server on 127.0.0.1 only still lets `::` bind on macOS.
	await bind("127.0.0.1");
	await bind("::").catch((error: NodeJS.ErrnoException) => {
		if (error.code !== "EAFNOSUPPORT" && error.code !== "EADDRNOTAVAIL") {
			throw error;
		}
	});
} catch (error) {
	const { code, message } = error as NodeJS.ErrnoException;
	console.error(
		code === "EADDRINUSE"
			? `Port ${port} is in use: stop the process on it (lsof -i :${port}) before running Lighthouse.`
			: `Cannot check port ${port}: ${message}`,
	);
	process.exit(1);
}
