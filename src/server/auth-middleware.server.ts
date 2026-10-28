import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { serverEnv } from "#/config/env";
import { resolveLocale } from "#/i18n/locale";
import type { AppClient, AppUser } from "#/lib/appwrite/app-models";
import {
	createAdminClient,
	createAnonymousClient,
	createUserClient,
} from "#/lib/appwrite/server-client.server";
import { AppError, toAppError } from "#/lib/errors";
import { appLink } from "./app-link";
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
	sessionCookie: SessionCookie;
	preferenceCookies: PreferenceCookies;
	browserPrefs: ServerContext["browserPrefs"];
	clientIp: string;
	userAgent: string | undefined;
	appUrl: string;
	createUserClient(sessionSecret: string): AppClient<"server">;
	createAdminClient(options: {
		forwardedUserAgent?: string;
	}): AppClient<"admin">;
	createAnonymousClient(): AppClient<"server">;
	rateLimit: ServerContext["rateLimit"];
};

/** Builds the per-request context. Nothing touches Appwrite until a handler asks. */
export function buildServerContext(deps: ServerContextDeps): ServerContext {
	const { sessionCookie } = deps;
	let sessionGone = false;
	let userClient: AppClient<"server"> | undefined;
	let adminClient: AppClient<"admin"> | undefined;
	let user: Promise<AppUser | null> | undefined;

	function secret(): string | undefined {
		return sessionGone ? undefined : sessionCookie.read();
	}

	function appwriteUser(): AppClient<"server"> {
		const sessionSecret = secret();
		if (!sessionSecret) throw new AppError("UNAUTHENTICATED");
		userClient ??= deps.createUserClient(sessionSecret);
		return userClient;
	}

	async function loadUser(): Promise<AppUser | null> {
		if (!secret()) return null;
		try {
			return await appwriteUser().account.get();
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
		appwrite: {
			user: appwriteUser,
			forSession: (sessionSecret) => deps.createUserClient(sessionSecret),
			admin: () => {
				adminClient ??= deps.createAdminClient({
					forwardedUserAgent: deps.userAgent,
				});
				return adminClient;
			},
			anonymous: () => deps.createAnonymousClient(),
		},
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
export function buildRequestContext(): ServerContext {
	return buildServerContext({
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
		createUserClient,
		createAdminClient,
		createAnonymousClient,
		rateLimit,
	});
}
