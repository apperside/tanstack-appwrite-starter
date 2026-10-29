import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";
import { serverEnv } from "#/config/env";
import type { SessionCookie } from "./context";

export const SESSION_COOKIE = "app_session";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Secure everywhere except plain-http loopback dev (Safari drops Secure cookies on http://127.0.0.1). */
export function isSecure(appUrl: string): boolean {
	const { protocol, hostname } = new URL(appUrl);
	return !(protocol === "http:" && LOOPBACK_HOSTS.has(hostname));
}

function scope() {
	return {
		httpOnly: true,
		secure: isSecure(serverEnv().APP_URL),
		sameSite: "lax",
		path: "/",
	} as const;
}

/** The session cookie over Start's request helpers; callable only inside a request. */
export function requestSessionCookie(): SessionCookie {
	return {
		read: () => getCookie(SESSION_COOKIE),
		write: (session) =>
			setCookie(SESSION_COOKIE, session.token, {
				...scope(),
				expires: new Date(session.expiresAt),
			}),
		clear: () => deleteCookie(SESSION_COOKIE, scope()),
	};
}
