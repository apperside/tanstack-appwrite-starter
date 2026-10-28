import { describe, expect, it } from "vitest";
import {
	ONE_YEAR_SECONDS,
	readCookie,
	writePreferenceCookie,
	writeSessionCookie,
} from "./cookies";

describe("readCookie", () => {
	it("finds a cookie among others, trimming whitespace", () => {
		expect(readCookie("a=1; locale=it ;b=2", "locale")).toBe("it");
	});

	it("keeps `=` inside the value", () => {
		expect(readCookie("token=a=b", "token")).toBe("a=b");
	});

	it("is undefined when missing, prefixed or valueless", () => {
		expect(readCookie("", "locale")).toBeUndefined();
		expect(readCookie("mylocale=it", "locale")).toBeUndefined();
		expect(readCookie("locale", "locale")).toBeUndefined();
	});
});

describe("writePreferenceCookie", () => {
	const fakeDocument = (protocol: string) => ({
		cookie: "",
		location: { protocol },
	});

	it("writes a one-year, lax, root-path cookie readable by the client", () => {
		const doc = fakeDocument("http:");
		writePreferenceCookie("sidebar_state", "collapsed", doc);
		expect(doc.cookie).toBe(
			`sidebar_state=collapsed; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`,
		);
		expect(ONE_YEAR_SECONDS).toBe(31_536_000);
	});

	it("is secure over https", () => {
		const doc = fakeDocument("https:");
		writePreferenceCookie("theme", "dark", doc);
		expect(doc.cookie).toMatch(/; secure$/);
	});
});

describe("writeSessionCookie", () => {
	it("writes a lax, root-path cookie that ends with the browser session", () => {
		const doc = { cookie: "", location: { protocol: "http:" } };
		writeSessionCookie("guest_banner_dismissed", "1", doc);
		expect(doc.cookie).toBe("guest_banner_dismissed=1; path=/; samesite=lax");
	});

	it("is secure over https", () => {
		const doc = { cookie: "", location: { protocol: "https:" } };
		writeSessionCookie("guest_banner_dismissed", "1", doc);
		expect(doc.cookie).toBe(
			"guest_banner_dismissed=1; path=/; samesite=lax; secure",
		);
	});
});
