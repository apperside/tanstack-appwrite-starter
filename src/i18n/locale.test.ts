import { describe, expect, it } from "vitest";
import {
	clientLocaleHints,
	isLocale,
	LOCALE_COOKIE,
	resolveLocale,
} from "./locale";

describe("resolveLocale", () => {
	it("prefers the account preference over the cookie", () => {
		expect(resolveLocale({ prefsLocale: "it", cookieLocale: "en" })).toBe("it");
	});

	it("prefers the cookie over Accept-Language when there are no prefs", () => {
		expect(resolveLocale({ cookieLocale: "it", acceptLanguage: "en" })).toBe(
			"it",
		);
	});

	it("picks the best supported Accept-Language match by q-weight", () => {
		expect(resolveLocale({ acceptLanguage: "fr-FR,it;q=0.8,en;q=0.5" })).toBe(
			"it",
		);
		expect(resolveLocale({ acceptLanguage: "en;q=0.4, it-IT;q=0.9" })).toBe(
			"it",
		);
		expect(resolveLocale({ acceptLanguage: "IT-it,en;q=0.9" })).toBe("it");
	});

	it("keeps header order between equal q-weights", () => {
		expect(resolveLocale({ acceptLanguage: "en-GB,it" })).toBe("en");
	});

	it("ignores q=0, wildcards and malformed weights", () => {
		expect(resolveLocale({ acceptLanguage: "it;q=0,*;q=0.5" })).toBe("en");
		expect(resolveLocale({ acceptLanguage: "it;q=abc,fr" })).toBe("en");
	});

	it("skips invalid values and falls back to en", () => {
		expect(resolveLocale({ cookieLocale: "xx" })).toBe("en");
		expect(
			resolveLocale({
				prefsLocale: "xx",
				cookieLocale: "",
				acceptLanguage: "",
			}),
		).toBe("en");
		expect(resolveLocale({})).toBe("en");
	});

	it("skips an invalid preference and uses the next source", () => {
		expect(resolveLocale({ prefsLocale: "de", cookieLocale: "it" })).toBe("it");
	});
});

describe("isLocale", () => {
	it("accepts only supported locales", () => {
		expect(["en", "it", "fr", undefined, 1].map(isLocale)).toEqual([
			true,
			true,
			false,
			false,
			false,
		]);
	});
});

it("names the cookie locale", () => {
	expect(LOCALE_COOKIE).toBe("locale");
});

describe("clientLocaleHints", () => {
	const doc = (cookie: string, lang: string) => ({
		cookie,
		documentElement: { lang },
	});

	it("keeps the SSR-resolved locale on client navigations without prefs or cookie", () => {
		// The server matched `it` from Accept-Language; navigator.languages is never consulted.
		expect(resolveLocale(clientLocaleHints(doc("theme=dark", "it")))).toBe(
			"it",
		);
	});

	it("lets the cookie win over the rendered lang", () => {
		expect(clientLocaleHints(doc("locale=en; theme=dark", "it"))).toEqual({
			cookieLocale: "en",
			acceptLanguage: "it",
		});
		expect(resolveLocale(clientLocaleHints(doc("locale=en", "it")))).toBe("en");
	});

	it("still lets the account preference win", () => {
		expect(
			resolveLocale({ prefsLocale: "en", ...clientLocaleHints(doc("", "it")) }),
		).toBe("en");
	});
});
