import { describe, expect, it } from "vitest";
import type { ThemePreference } from "#/core/prefs";
import {
	applyTheme,
	parseThemeCookie,
	resolveTheme,
	resolveThemePreference,
	themeInitScript,
} from "./theme";

describe("resolveTheme", () => {
	it.each([
		["system", true, "dark"],
		["system", false, "light"],
		["light", true, "light"],
		["light", false, "light"],
		["dark", true, "dark"],
		["dark", false, "dark"],
	] as const)("resolves %s (prefers dark: %s) to %s", (pref, prefersDark, expected) => {
		expect(resolveTheme(pref, prefersDark)).toBe(expected);
	});
});

describe("resolveThemePreference", () => {
	it("prefers the account's theme, then the cookie's", () => {
		expect(
			resolveThemePreference({ prefsTheme: "dark", cookieTheme: "light" }),
		).toBe("dark");
		expect(resolveThemePreference({ cookieTheme: "light" })).toBe("light");
	});

	it("skips an invalid account value", () => {
		expect(
			resolveThemePreference({ prefsTheme: "purple", cookieTheme: "light" }),
		).toBe("light");
	});
});

describe("parseThemeCookie", () => {
	it("reads the theme cookie among others", () => {
		expect(parseThemeCookie("locale=it; theme=dark; x=1")).toBe("dark");
		expect(parseThemeCookie("theme=light")).toBe("light");
	});

	it("falls back to system when missing or invalid", () => {
		expect(parseThemeCookie("")).toBe("system");
		expect(parseThemeCookie("mytheme=dark")).toBe("system");
		expect(parseThemeCookie("theme=purple")).toBe("system");
	});

	it("honours a custom cookie name", () => {
		expect(parseThemeCookie("ui=dark; theme=light", "ui")).toBe("dark");
	});
});

/**
 * Runs the inline script against a minimal fake `document`/`window`; `pref`
 * is the `data-theme` the server rendered on `<html>` (`null`: none).
 */
function runScript(pref: string | null, prefersDark: boolean) {
	const classes = new Set<string>(["stale"]);
	const listeners: Array<() => void> = [];
	const media = {
		matches: prefersDark,
		addEventListener: (_: string, fn: () => void) => listeners.push(fn),
	};
	const attributes = new Map<string, string>();
	if (pref !== null) attributes.set("data-theme", pref);
	const document = {
		cookie: "theme=light",
		documentElement: {
			getAttribute: (name: string) => attributes.get(name) ?? null,
			classList: {
				add: (c: string) => classes.add(c),
				remove: (...cs: string[]) => {
					for (const c of cs) classes.delete(c);
				},
			},
		},
	};
	const window = { matchMedia: () => media };
	new Function("document", "window", themeInitScript())(document, window);
	const theme = () => [...classes].filter((c) => c !== "stale");
	return { theme, media, attributes, listeners };
}

describe("themeInitScript", () => {
	it("never touches localStorage", () => {
		expect(themeInitScript()).not.toContain("localStorage");
	});

	const prefs: ThemePreference[] = ["light", "dark", "system"];
	for (const pref of prefs) {
		for (const prefersDark of [true, false]) {
			it(`agrees with resolveTheme for ${pref} (prefers dark: ${prefersDark})`, () => {
				const { theme } = runScript(pref, prefersDark);
				expect(theme()).toEqual([resolveTheme(pref, prefersDark)]);
			});
		}
	}

	it("follows the preference the server rendered, never a stale cookie", () => {
		// The cookie says light; the account (rendered as data-theme) says dark.
		expect(runScript("dark", false).theme()).toEqual(["dark"]);
	});

	it("treats a missing or unknown preference as system", () => {
		expect(runScript(null, true).theme()).toEqual(["dark"]);
		expect(runScript("purple", false).theme()).toEqual(["light"]);
	});

	it("follows OS changes while the preference is system", () => {
		const run = runScript("system", false);
		run.media.matches = true;
		for (const fn of run.listeners) fn();
		expect(run.theme()).toEqual(["dark"]);
	});

	it("ignores OS changes once the preference is explicit", () => {
		const run = runScript("system", false);
		run.attributes.set("data-theme", "light");
		run.media.matches = true;
		for (const fn of run.listeners) fn();
		expect(run.theme()).toEqual(["light"]);
	});

	it("never throws, even without matchMedia", () => {
		const script = themeInitScript();
		expect(() =>
			new Function("document", "window", script)({ cookie: "" }, {}),
		).not.toThrow();
	});
});

describe("applyTheme", () => {
	function fakeWindow(prefersDark: boolean) {
		const classes = new Set<string>(["stale", "light"]);
		const win = {
			matchMedia: (query: string) => ({
				matches: query === "(prefers-color-scheme: dark)" && prefersDark,
			}),
			document: {
				documentElement: {
					classList: {
						add: (c: string) => classes.add(c),
						remove: (...cs: string[]) => {
							for (const c of cs) classes.delete(c);
						},
					},
				},
			},
		};
		return { win, theme: () => [...classes].filter((c) => c !== "stale") };
	}

	const prefs: ThemePreference[] = ["light", "dark", "system"];
	for (const pref of prefs) {
		for (const prefersDark of [true, false]) {
			it(`paints what the init script paints for ${pref} (prefers dark: ${prefersDark})`, () => {
				const { win, theme } = fakeWindow(prefersDark);
				applyTheme(pref, win);
				expect(theme()).toEqual(runScript(pref, prefersDark).theme());
			});
		}
	}
});
