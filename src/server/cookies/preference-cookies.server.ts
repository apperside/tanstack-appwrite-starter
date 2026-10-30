import {
	deleteCookie,
	getRequestHeader,
	setCookie,
} from "@tanstack/react-start/server";
import { serverEnv } from "#/config/env";
import { LOCALE_COOKIE, type LocaleSources } from "#/i18n/locale";
import { ONE_YEAR_SECONDS, readCookie } from "#/lib/cookies";
import { GUEST_BANNER_COOKIE } from "#/lib/guest-banner";
import { THEME_COOKIE } from "#/lib/theme";
import type { PreferenceCookies } from "./context";
import { isSecure } from "./session-cookie.server";

/** Readable by the client (no httpOnly): the theme script and i18n detection use them. */
function scope() {
	return {
		secure: isSecure(serverEnv().APP_URL),
		sameSite: "lax",
		path: "/",
		maxAge: ONE_YEAR_SECONDS,
	} as const;
}

/** The preference cookies over Start's request helpers; callable only inside a request. */
export function requestPreferenceCookies(): PreferenceCookies {
	return {
		writeLocale: (locale) => setCookie(LOCALE_COOKIE, locale, scope()),
		writeTheme: (theme) => setCookie(THEME_COOKIE, theme, scope()),
		// The client writes it (a browser-session cookie on `path=/`); a cookie
		// is matched by name and path, so this deletes that one.
		clearGuestBannerDismissed: () =>
			deleteCookie(GUEST_BANNER_COOKIE, { path: "/" }),
	};
}

/** The current request's `Cookie` header, for the shared cookie parsers. */
export function requestCookieHeader(): string {
	return getRequestHeader("cookie") ?? "";
}

/** The request's locale cookie and `Accept-Language`, for `resolveLocale`. */
export function readLocaleHints(): Omit<LocaleSources, "prefsLocale"> {
	return {
		cookieLocale: readCookie(requestCookieHeader(), LOCALE_COOKIE),
		acceptLanguage: getRequestHeader("accept-language"),
	};
}
