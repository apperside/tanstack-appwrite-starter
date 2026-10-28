import {
	deleteCookie,
	getRequestHeader,
	setCookie,
} from "@tanstack/react-start/server";
import { serverEnv } from "#/config/env";
import { LOCALE_COOKIE, type LocaleSources } from "#/i18n/locale";
import type { ThemePreference } from "#/lib/appwrite/app-models";
import { ONE_YEAR_SECONDS, readCookie } from "#/lib/cookies";
import {
	GUEST_BANNER_COOKIE,
	parseGuestBannerCookie,
} from "#/lib/guest-banner";
import { parseSidebarCookie, type SidebarMode } from "#/lib/sidebar-state";
import { parseThemeCookie, THEME_COOKIE } from "#/lib/theme";
import type { PreferenceCookies } from "./context";
import { isSecure } from "./session-cookie.server";

export { LOCALE_COOKIE, THEME_COOKIE };

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

/** The theme preference sent with the current request; `system` when absent or invalid. */
export function readThemeCookie(): ThemePreference {
	return parseThemeCookie(getRequestHeader("cookie") ?? "");
}

/** The request's locale cookie and `Accept-Language`, for `resolveLocale`. */
export function readLocaleHints(): Omit<LocaleSources, "prefsLocale"> {
	return {
		cookieLocale: readCookie(getRequestHeader("cookie") ?? "", LOCALE_COOKIE),
		acceptLanguage: getRequestHeader("accept-language"),
	};
}

/** The sidebar mode sent with the current request; `auto` when absent or invalid. */
export function readSidebarCookie(): SidebarMode {
	return parseSidebarCookie(getRequestHeader("cookie") ?? "");
}

/** Whether the guest banner was dismissed in this browser session. */
export function readGuestBannerDismissed(): boolean {
	return parseGuestBannerCookie(getRequestHeader("cookie") ?? "");
}
