/** The raw value of `name` in a `Cookie` header / `document.cookie` string, if present. */
export function readCookie(cookies: string, name: string): string | undefined {
	for (const pair of cookies.split(";")) {
		const separator = pair.indexOf("=");
		if (separator === -1) continue;
		if (pair.slice(0, separator).trim() === name) {
			return pair.slice(separator + 1).trim();
		}
	}
	return undefined;
}

/** Lifetime of every preference cookie (locale, theme, sidebar). */
export const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

type CookieDocument = {
	cookie: string;
	location: { protocol: string };
};

/** `path=/`, `SameSite=Lax`, `Secure` over HTTPS: the scope the server writes too. */
function writeClientCookie(
	doc: CookieDocument,
	name: string,
	value: string,
	maxAge?: number,
) {
	const lifetime = maxAge === undefined ? "" : `; max-age=${maxAge}`;
	const secure = doc.location.protocol === "https:" ? "; secure" : "";
	doc.cookie = `${name}=${value}; path=/${lifetime}; samesite=lax${secure}`;
}

/**
 * Writes a client-readable preference cookie from the browser, scoped like the
 * server's (`path=/`, a year, `SameSite=Lax`, `Secure` over HTTPS) so both
 * sides read and overwrite the same cookie.
 */
export function writePreferenceCookie(
	name: string,
	value: string,
	doc: CookieDocument = document,
) {
	writeClientCookie(doc, name, value, ONE_YEAR_SECONDS);
}

/** Like `writePreferenceCookie`, but the cookie ends with the browser session. */
export function writeSessionCookie(
	name: string,
	value: string,
	doc: CookieDocument = document,
) {
	writeClientCookie(doc, name, value);
}
