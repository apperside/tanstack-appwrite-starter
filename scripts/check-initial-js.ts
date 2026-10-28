/**
 * Initial-JS budget: for each public page, sums the gzip size of every
 * same-origin `<script src>` and `<link rel="modulepreload">` in the server
 * HTML, and fails if a page exceeds the budget.
 *
 * Usage:
 *   node scripts/check-initial-js.ts [--base-url <url>]   (Node 24 strips the types)
 *
 * Without `--base-url` it starts the production build (`.output/server/index.mjs`,
 * env from `.env.local` when present) on a free port and stops it on exit.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";

const PAGES = ["/login", "/signup", "/forgot-password"];
/**
 * A regression guard, not the spec's original 120 KB (ruling R38): React,
 * TanStack Router/Start/Query and i18next alone measure ≈134 KB gzip, and the
 * public pages measure ≈187 KB (10 scripts each).
 */
const BUDGET_BYTES = 200_000;
const SERVER_ENTRY = ".output/server/index.mjs";
const STARTUP_TIMEOUT_MS = 20_000;

const kb = (bytes: number) => `${(bytes / 1000).toFixed(1)} KB`;

function freePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const probe = createServer();
		probe.unref();
		probe.on("error", reject);
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			const port = typeof address === "object" && address ? address.port : 0;
			probe.close(() => resolve(port));
		});
	});
}

async function startServer(): Promise<{
	baseUrl: string;
	child: ChildProcess;
}> {
	if (!existsSync(SERVER_ENTRY)) {
		throw new Error(`${SERVER_ENTRY} not found — run \`pnpm build\` first.`);
	}
	const port = await freePort();
	const child = spawn(
		process.execPath,
		["--env-file-if-exists=.env.local", SERVER_ENTRY],
		{
			env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
			stdio: "ignore",
		},
	);
	const baseUrl = `http://127.0.0.1:${port}`;
	const deadline = Date.now() + STARTUP_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (child.exitCode !== null) {
			throw new Error(`Server exited early with code ${child.exitCode}.`);
		}
		try {
			await fetch(`${baseUrl}${PAGES[0]}`);
			return { baseUrl, child };
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}
	child.kill();
	throw new Error(`Server did not start within ${STARTUP_TIMEOUT_MS} ms.`);
}

/** Same-origin `<script src>` and `<link rel="modulepreload">` URLs, in document order. */
function initialScripts(html: string, pageUrl: URL): URL[] {
	const urls = new Map<string, URL>();
	for (const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
		const isScript = /^<script/i.test(tag);
		if (!isScript && !/\brel=["']?modulepreload\b/i.test(tag)) continue;
		const ref = tag.match(
			isScript ? /\bsrc=["']([^"']+)/i : /\bhref=["']([^"']+)/i,
		)?.[1];
		if (!ref) continue;
		const url = new URL(ref.replaceAll("&amp;", "&"), pageUrl);
		if (url.origin === pageUrl.origin) urls.set(url.href, url);
	}
	return [...urls.values()];
}

async function fetchOk(url: URL | string): Promise<Response> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`GET ${url} → ${response.status}`);
	return response;
}

async function measurePage(baseUrl: string, path: string) {
	const pageUrl = new URL(path, baseUrl);
	const html = await (await fetchOk(pageUrl)).text();
	const files = await Promise.all(
		initialScripts(html, pageUrl).map(async (url) => {
			const body = new Uint8Array(await (await fetchOk(url)).arrayBuffer());
			return {
				path: url.pathname,
				raw: body.byteLength,
				gzip: gzipSync(body).byteLength,
			};
		}),
	);
	files.sort((a, b) => b.gzip - a.gzip);
	const total = files.reduce((sum, file) => sum + file.gzip, 0);
	return { path, files, total };
}

async function main() {
	const { values } = parseArgs({ options: { "base-url": { type: "string" } } });
	const server = values["base-url"] ? undefined : await startServer();
	const baseUrl = values["base-url"] ?? server?.baseUrl ?? "";
	try {
		let failed = false;
		for (const path of PAGES) {
			const page = await measurePage(baseUrl, path);
			if (page.files.length === 0) {
				// A page without scripts means the measurement broke, not a win.
				console.log(`FAIL  ${path}: no same-origin scripts found`);
				failed = true;
				continue;
			}
			const over = page.total > BUDGET_BYTES;
			failed ||= over;
			console.log(`\n${path} — ${page.files.length} files`);
			console.table(
				page.files.map((file) => ({
					file: file.path,
					raw: kb(file.raw),
					gzip: kb(file.gzip),
				})),
			);
			console.log(
				`${over ? "FAIL" : "ok"}  ${path}: ${kb(page.total)} gzip (budget ${kb(BUDGET_BYTES)})`,
			);
		}
		if (failed) process.exitCode = 1;
	} finally {
		server?.child.kill();
	}
}

await main();
