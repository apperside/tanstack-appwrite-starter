import { Duplex } from "node:stream";
import { constants, createGzip } from "node:zlib";

/** Smaller bodies are not worth a compression pass (and gzip may grow them). */
const MIN_BYTES = 1024;

/** `gzip` (or `*`) listed in Accept-Encoding without `q=0`. */
function acceptsGzip(request: Request): boolean {
	const header = request.headers.get("accept-encoding") ?? "";
	return header.split(",").some((entry) => {
		const [coding = "", ...params] = entry
			.split(";")
			.map((part) => part.trim());
		if (coding !== "gzip" && coding !== "*") return false;
		const q = params.find((param) => param.startsWith("q="));
		return !q || Number(q.slice(2)) > 0;
	});
}

/**
 * An HTML page gzip-encoded when the client accepts it (static assets are
 * pre-compressed at build time; other responses pass through untouched).
 * Every HTML page gets `Vary: Accept-Encoding`, compressed or not, so a shared
 * cache never serves one encoding to a client that asked for another.
 *
 * Skipped for HEAD, already-encoded, `Cache-Control: no-transform` and
 * sub-1 KB responses.
 *
 * Each chunk is flushed as it is written, so a streamed SSR page still reaches
 * the browser progressively.
 */
export function compressHtml(request: Request, response: Response): Response {
	if (!response.headers.get("content-type")?.startsWith("text/html")) {
		return response;
	}
	// A copy: the original headers may be immutable.
	const headers = new Headers(response.headers);
	if (
		!/(^|,)\s*(accept-encoding|\*)\s*(,|$)/i.test(headers.get("vary") ?? "")
	) {
		headers.append("vary", "Accept-Encoding");
	}
	const length = Number(headers.get("content-length") ?? Number.NaN);
	const compress =
		request.method !== "HEAD" &&
		!headers.has("content-encoding") &&
		!/\bno-transform\b/i.test(headers.get("cache-control") ?? "") &&
		!(length < MIN_BYTES) && // a streamed page has no length: compress it
		acceptsGzip(request);
	let body = response.body;
	if (body && compress) {
		headers.set("content-encoding", "gzip");
		headers.delete("content-length");
		// Node's web-stream types differ nominally from the DOM ones; same runtime object.
		const gzip = Duplex.toWeb(
			createGzip({ flush: constants.Z_SYNC_FLUSH }),
		) as unknown as TransformStream<
			Uint8Array<ArrayBuffer>,
			Uint8Array<ArrayBuffer>
		>;
		body = body.pipeThrough(gzip);
	}
	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
