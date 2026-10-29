import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { serverEnv } from "#/config/env";
import type { SessionAuth } from "#/core/auth/ports";
import type { User } from "#/core/auth/types";
import type { Backend } from "#/core/backend";
import { resolveLocale } from "#/i18n/locale";
import { AppError, toAppError } from "#/lib/errors";
import { appLink } from "./app-link";
import { getBackend } from "./backend.server";
import { resolveClientIp } from "./client-ip.server";
import type {
	PreferenceCookies,
	ServerContext,
	SessionCookie,
} from "./context";
import {
	readLocaleHints,
	readThemeCookie,
	requestPreferenceCookies,
} from "./preference-cookies.server";
import { rateLimit } from "./rate-limit.server";
import { requestSessionCookie } from "./session-cookie.server";

type ServerContextDeps = {
	backend: Backend;
	sessionCookie: SessionCookie;
	preferenceCookies: PreferenceCookies;
	browserPrefs: ServerContext["browserPrefs"];
	clientIp: string;
	userAgent: string | undefined;
	appUrl: string;
	rateLimit: ServerContext["rateLimit"];
};

/** Builds the per-request context. Nothing touches the backend until a handler asks. */
export function buildServerContext(deps: ServerContextDeps): ServerContext {
	const { sessionCookie } = deps;
	const auth = deps.backend.auth({ userAgent: deps.userAgent });
	let sessionGone = false;
	let user: Promise<User | null> | undefined;

	function secret(): string | undefined {
		return sessionGone ? undefined : sessionCookie.read();
	}

	function session(): SessionAuth {
		const token = secret();
		if (!token) throw new AppError("UNAUTHENTICATED");
		return auth.session(token);
	}

	async function loadUser(): Promise<User | null> {
		if (!secret()) return null;
		try {
			return await session().getUser();
		} catch (error) {
			const appError = toAppError(error);
			if (appError.code !== "UNAUTHENTICATED") throw appError;
			// Expired or revoked: forget the cookie and behave as signed out.
			sessionGone = true;
			sessionCookie.clear();
			return null;
		}
	}

	return {
		auth,
		session,
		data: deps.backend.data,
		getUser: () => {
			user ??= loadUser();
			return user;
		},
		sessionCookie,
		preferenceCookies: deps.preferenceCookies,
		browserPrefs: deps.browserPrefs,
		clientIp: deps.clientIp,
		userAgent: deps.userAgent,
		appLink: (path) => appLink(deps.appUrl, path),
		rateLimit: deps.rateLimit,
	};
}

/** The context for the current request; only valid inside a request handler. */
export async function buildRequestContext(): Promise<ServerContext> {
	return buildServerContext({
		backend: await getBackend(),
		sessionCookie: requestSessionCookie(),
		preferenceCookies: requestPreferenceCookies(),
		browserPrefs: {
			locale: resolveLocale(readLocaleHints()),
			theme: readThemeCookie(),
		},
		// X-Forwarded-For is client-controlled: trust only the hops our proxies add.
		clientIp: resolveClientIp({
			socketIp: getRequestIP(),
			forwardedFor: getRequestHeader("x-forwarded-for"),
			trustedProxyHops: serverEnv().TRUSTED_PROXY_HOPS,
		}),
		userAgent: getRequestHeader("user-agent"),
		appUrl: serverEnv().APP_URL,
		rateLimit,
	});
}
