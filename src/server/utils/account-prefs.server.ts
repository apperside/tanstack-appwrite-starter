import { type AppPrefs, DEFAULT_PREFS } from "#/core/prefs";
import { isLocale } from "#/i18n/locale";
import { isThemePreference } from "#/lib/theme";
import type { ServerContext } from "../context/context.types";

/*
 * The preference model (R39): the account's prefs are the source of truth for
 * a signed-in user; the `locale` and `theme` cookies are only the first-paint
 * cache, and only the server writes them.
 */

/** A new account's or guest's prefs: the defaults, in the language and theme being browsed. */
export function seedPrefs(
	context: Pick<ServerContext, "browserPrefs">,
): AppPrefs {
	return { ...DEFAULT_PREFS, ...context.browserPrefs };
}

/**
 * Mirrors an account's locale and theme into the cookies, so the next first
 * paint matches it. A missing or invalid one leaves the browser's cookie.
 */
export function writePreferenceCookies(
	context: Pick<ServerContext, "preferenceCookies">,
	prefs: { locale?: unknown; theme?: unknown },
): void {
	if (isLocale(prefs.locale))
		context.preferenceCookies.writeLocale(prefs.locale);
	if (isThemePreference(prefs.theme)) {
		context.preferenceCookies.writeTheme(prefs.theme);
	}
}

/**
 * Merges `patch` into the signed-in user's stored prefs (the backend merges:
 * the context's user may be stale) and mirrors a changed locale or theme into
 * the cookies. Never stamps the defaults over what was not saved: readers
 * fall back to them.
 */
export async function savePrefs(
	context: Pick<ServerContext, "session" | "preferenceCookies">,
	patch: Partial<AppPrefs>,
): Promise<Partial<AppPrefs>> {
	const merged = await context.session().updatePrefs(patch);
	writePreferenceCookies(context, patch);
	return merged;
}
