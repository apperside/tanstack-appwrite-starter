import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { lazy, Suspense, useLayoutEffect } from "react";
import type { TypedQueryClient } from "tanstack-query-typed";
import { Toasts } from "#/client/components/ui/toast";
import { currentUserQuery } from "#/client/features/auth/auth.queries";
import { loadResources } from "#/i18n/i18n";
import { I18nProvider } from "#/i18n/i18n-provider";
import { DEFAULT_LOCALE, resolveLocale } from "#/i18n/locale";
import {
	applyTheme,
	resolveThemePreference,
	themeInitScript,
} from "#/lib/theme";
import { api } from "#/server/api/api";
import appCss from "#/styles.css?url";

// DEV only: the condition is statically false in production builds, so the chunk is dropped.
const AppDevtools = import.meta.env.DEV
	? lazy(() => import("#/integrations/devtools"))
	: null;

interface MyRouterContext {
	queryClient: TypedQueryClient;
}

// Built once per module load: the script is static.
const THEME_INIT_SCRIPT = themeInitScript();

export const Route = createRootRouteWithContext<MyRouterContext>()({
	beforeLoad: async ({ context }) => {
		const [user, cookieTheme, localeHints] = await Promise.all([
			context.queryClient
				.ensureQueryData(currentUserQuery)
				.catch(async (error: unknown) => {
					// Appwrite down or a 5xx: RouteError shows it with a retry. A
					// failed root keeps no context, so the shell falls back to the
					// default language and theme; load that language for it.
					await loadResources(DEFAULT_LOCALE);
					throw error;
				}),
			api.preferences.getThemePreference(),
			api.preferences.getLocaleHints(),
		]);
		// The account's preferences win; the cookies are the first-paint cache
		// for everyone else (R39).
		const theme = resolveThemePreference({
			prefsTheme: user?.prefs.theme,
			cookieTheme,
		});
		const locale = resolveLocale({
			prefsLocale: user?.prefs.locale,
			...localeHints,
		});
		// Preloaded so I18nProvider renders synchronously on the server and on
		// client navigations (a locale switch fetches only the new locale's chunk).
		await loadResources(locale);
		return { user, theme, locale };
	},
	head: async ({ match }) => {
		// Cached after beforeLoad, so this does not fetch again. No locale: the
		// root failed (see beforeLoad), and the shell uses the default.
		const { common } = await loadResources(
			match.context.locale ?? DEFAULT_LOCALE,
		);
		return {
			meta: [
				{
					charSet: "utf-8",
				},
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1, viewport-fit=cover",
				},
				{ title: common.appName },
				{ name: "description", content: common.appDescription },
			],
			links: [
				{
					rel: "stylesheet",
					href: appCss,
				},
				{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
			],
		};
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	// Undefined when the root failed before resolving them (see beforeLoad).
	const { theme = "system", locale = DEFAULT_LOCALE } = Route.useRouteContext();
	// React drops the class attribute when the preference becomes `system`;
	// paint the OS theme back before the browser does.
	useLayoutEffect(() => {
		if (theme === "system") applyTheme("system");
	}, [theme]);
	return (
		// An explicit preference is rendered by the server (no flash, even without JS);
		// `system` is resolved by the inline script from `data-theme`, hence
		// suppressHydrationWarning.
		<html
			lang={locale}
			data-theme={theme}
			className={theme === "system" ? undefined : theme}
			suppressHydrationWarning
		>
			<head>
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, trusted inline theme-init script that must run before paint */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="min-h-svh [overflow-wrap:anywhere]">
				<I18nProvider locale={locale}>
					{children}
					<Toasts />
				</I18nProvider>
				{AppDevtools && (
					<Suspense fallback={null}>
						<AppDevtools />
					</Suspense>
				)}
				<Scripts />
			</body>
		</html>
	);
}
