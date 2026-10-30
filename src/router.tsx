import {
	createRouter as createTanStackRouter,
	rootRouteId,
} from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { asTypedQueryClient } from "tanstack-query-typed";
import { NotFound } from "./client/components/layout/not-found";
import { PageSkeleton } from "./client/components/layout/page-skeleton";
import { RouteError } from "./client/components/layout/route-error";
import { forgetExpiredSession } from "./client/features/auth/session-expiry";
import { loadedResources, primeResources, type Resources } from "./i18n/i18n";
import type { Locale } from "./i18n/locale";
import { createQueryClient } from "./lib/query-client";
import { parseSearch } from "./lib/search-params";
import { routeTree } from "./routeTree.gen";

type DehydratedState = { i18n?: { locale: Locale; resources: Resources } };

export function getRouter() {
	const queryClient = createQueryClient({
		onUnauthenticated: () => forgetExpiredSession({ queryClient, router }),
	});
	const context = { queryClient: asTypedQueryClient(queryClient) };

	const router = createTanStackRouter({
		routeTree,
		context,
		scrollRestoration: true,
		// Email links carry ids the default JSON reading could alter.
		parseSearch,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: RouteError,
		defaultNotFoundComponent: NotFound,
		defaultPendingComponent: PageSkeleton,
		// Fast navigations never flash a skeleton; a shown one stays long enough to read.
		defaultPendingMs: 300,
		defaultPendingMinMs: 200,
		// The page's translations travel with it: hydration does not wait for a
		// round trip to fetch the locale chunk.
		dehydrate: (): DehydratedState => {
			const locale: Locale | undefined = router.state.matches.find(
				(match) => match.routeId === rootRouteId,
			)?.context.locale;
			const resources = locale && loadedResources(locale);
			return { i18n: locale && resources ? { locale, resources } : undefined };
		},
		hydrate: ({ i18n }) => {
			if (i18n) primeResources(i18n.locale, i18n.resources);
		},
	});

	setupRouterSsrQueryIntegration({ router, queryClient });

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
