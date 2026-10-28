import type { ThemePreference } from "#/lib/appwrite/app-models";
import { readCookie } from "#/lib/cookies";

/** The client-readable cookie holding the user's `ThemePreference`. */
export const THEME_COOKIE = "theme";

type ResolvedTheme = "light" | "dark";

const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** Whether `value` is a stored `ThemePreference`. */
export function isThemePreference(value: unknown): value is ThemePreference {
	return value === "light" || value === "dark" || value === "system";
}

/**
 * The preference to render: the signed-in user's, else this browser's cookie
 * (already `system` when absent). Mirrors `resolveLocale` (R39).
 */
export function resolveThemePreference({
	prefsTheme,
	cookieTheme,
}: {
	/** `AppUser.prefs.theme` of the signed-in user. */
	prefsTheme?: unknown;
	cookieTheme: ThemePreference;
}): ThemePreference {
	return isThemePreference(prefsTheme) ? prefsTheme : cookieTheme;
}

/** The theme actually painted: `system` follows the OS. */
export function resolveTheme(
	pref: ThemePreference,
	prefersDark: boolean,
): ResolvedTheme {
	if (pref === "system") return prefersDark ? "dark" : "light";
	return pref;
}

/** The preference stored in a `Cookie` header / `document.cookie`; `system` when absent or invalid. */
export function parseThemeCookie(
	cookies: string,
	cookieName = THEME_COOKIE,
): ThemePreference {
	const value = readCookie(cookies, cookieName);
	return value === "light" || value === "dark" ? value : "system";
}

/**
 * Inline `<head>` script that puts `light`/`dark` on `<html>` before first paint.
 * It reads the preference the server resolved into `<html data-theme>` (never
 * the cookie, which may be stale for a signed-in user): the server already
 * renders an explicit preference's class, so this resolves `system` and keeps
 * following the OS while the preference stays `system`.
 * It mirrors `resolveTheme` (the tests hold them in step) and is ES5 so it
 * runs before any bundle.
 */
export function themeInitScript(): string {
	return `(function(){try{var d=document.documentElement;var q=window.matchMedia(${JSON.stringify(DARK_SCHEME_QUERY)});function a(){var p=d.getAttribute("data-theme");var t=p==="light"||p==="dark"?p:q.matches?"dark":"light";d.classList.remove("light","dark");d.classList.add(t)}a();q.addEventListener("change",a)}catch(e){}})();`;
}

type ThemeWindow = {
	matchMedia: (query: string) => { matches: boolean };
	document: {
		documentElement: {
			classList: {
				add: (token: string) => void;
				remove: (...tokens: string[]) => void;
			};
		};
	};
};

/**
 * Paints `pref` on `<html>` now, exactly as the init script would (the tests
 * hold them in step). Used for an optimistic theme switch, and after React
 * renders `system` (it drops the class attribute, which the script set).
 */
export function applyTheme(pref: ThemePreference, win: ThemeWindow = window) {
	const theme = resolveTheme(pref, win.matchMedia(DARK_SCHEME_QUERY).matches);
	const { classList } = win.document.documentElement;
	classList.remove("light", "dark");
	classList.add(theme);
}
