import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";
import { serverEnv } from "#/config/env";
import type { SessionCookie } from "./context";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Secure everywhere except plain-http loopback dev (Safari drops Secure cookies on http://127.0.0.1). */
export function isSecure(appUrl: string): boolean {
	const { protocol, hostname } = new URL(appUrl);
	return !(protocol === "http:" && LOOPBACK_HOSTS.has(hostname));
}

/**
 * `__Host-` makes the browser refuse the cookie unless it is Secure, host-only
 * and `Path=/`, so a sibling subdomain cannot plant or overwrite it. Browsers
 * reject the prefix without Secure, so loopback dev keeps the plain name.
 */
export function sessionCookieName(secure: boolean): string {
	return secure ? "__Host-app_session" : "app_session";
}

function scope(secure: boolean) {
	return { httpOnly: true, secure, sameSite: "lax", path: "/" } as const;
}

/** The session cookie over Start's request helpers; callable only inside a request. */
export function requestSessionCookie(): SessionCookie {
	const secure = isSecure(serverEnv().APP_URL);
	const name = sessionCookieName(secure);
	return {
		read: () => getCookie(name),
		write: (session) =>
			setCookie(name, session.token, {
				...scope(secure),
				expires: new Date(session.expiresAt),
			}),
		clear: () => deleteCookie(name, scope(secure)),
	};
}
