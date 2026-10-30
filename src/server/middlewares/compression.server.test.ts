import { constants, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { compressHtml } from "./compression.server";

const PAGE = `<!doctype html><p>${"hello ".repeat(400)}</p>`;

function page(headers: Record<string, string> = {}, body: BodyInit = PAGE) {
	const response = new Response(body, {
		headers: { "content-type": "text/html; charset=utf-8", ...headers },
	});
	response.headers.append("set-cookie", "a=1");
	response.headers.append("set-cookie", "b=2");
	return response;
}

function request(acceptEncoding = "gzip, deflate, br", method = "GET") {
	return new Request("http://app.test/login", {
		method,
		headers: { "accept-encoding": acceptEncoding },
	});
}

describe("compressHtml", () => {
	it("gzips an HTML page and keeps status and cookies", async () => {
		const response = compressHtml(request(), page());

		expect(response.headers.get("content-encoding")).toBe("gzip");
		expect(response.headers.get("vary")).toBe("Accept-Encoding");
		expect(response.headers.has("content-length")).toBe(false);
		expect(response.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
		const body = Buffer.from(await response.arrayBuffer());
		expect(gunzipSync(body).toString()).toBe(PAGE);
	});

	it("flushes each streamed chunk instead of holding it until the end", async () => {
		let finish = () => {};
		const held = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const encoder = new TextEncoder();
		const stream = new ReadableStream<Uint8Array>({
			async start(controller) {
				controller.enqueue(encoder.encode("<!doctype html><p>shell</p>"));
				await held;
				controller.enqueue(encoder.encode("<p>late</p>"));
				controller.close();
			},
		});

		const response = compressHtml(request(), page({}, stream));
		const reader = (response.body as ReadableStream<Uint8Array>).getReader();
		const first = await reader.read();
		const partial = gunzipSync(first.value as Uint8Array, {
			finishFlush: constants.Z_SYNC_FLUSH,
		});
		expect(partial.toString()).toBe("<!doctype html><p>shell</p>");

		finish();
		await reader.cancel();
	});

	it("sends the page as is, still varying by encoding, when the client does not accept gzip", async () => {
		for (const encoding of ["br", "", "gzip;q=0, br", "identity"]) {
			const response = compressHtml(request(encoding), page());
			expect(response.headers.has("content-encoding")).toBe(false);
			expect(response.headers.get("vary")).toBe("Accept-Encoding");
			expect(response.headers.getSetCookie()).toEqual(["a=1", "b=2"]);
			expect(await response.text()).toBe(PAGE);
		}
		expect(
			compressHtml(request("br;q=1, gzip;q=0.5"), page()).headers.get(
				"content-encoding",
			),
		).toBe("gzip");
	});

	it("adds Accept-Encoding to an existing Vary without repeating it", () => {
		const cookie = compressHtml(request(), page({ vary: "Cookie" }));
		expect(cookie.headers.get("vary")).toBe("Cookie, Accept-Encoding");
		const already = compressHtml(
			request(),
			page({ vary: "Cookie, accept-encoding" }),
		);
		expect(already.headers.get("vary")).toBe("Cookie, accept-encoding");
		const any = compressHtml(request(), page({ vary: "*" }));
		expect(any.headers.get("vary")).toBe("*");
	});

	it("honours Cache-Control: no-transform", async () => {
		const response = compressHtml(
			request(),
			page({ "cache-control": "private, no-transform" }),
		);
		expect(response.headers.has("content-encoding")).toBe(false);
		expect(await response.text()).toBe(PAGE);
	});

	it("passes non-HTML responses through untouched", () => {
		const json = page({ "content-type": "application/json" });
		expect(compressHtml(request(), json)).toBe(json);
		expect(json.headers.has("vary")).toBe(false);
	});

	it("does not compress already encoded, tiny or HEAD responses", () => {
		const encoded = page({ "content-encoding": "br" });
		const tiny = page({ "content-length": "12" }, "<p>tiny</p>");

		expect(
			compressHtml(request(), encoded).headers.get("content-encoding"),
		).toBe("br");
		expect(compressHtml(request(), tiny).headers.has("content-encoding")).toBe(
			false,
		);
		expect(
			compressHtml(request("gzip", "HEAD"), page()).headers.has(
				"content-encoding",
			),
		).toBe(false);
	});
});
