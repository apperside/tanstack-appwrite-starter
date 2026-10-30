import {
	createMemoryHistory,
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import { act } from "@testing-library/react";
import { type ReactElement, StrictMode } from "react";
import {
	asTypedQueryClient,
	type TypedQueryClient,
} from "tanstack-query-typed";
import { currentUserQuery } from "#/client/features/auth/auth.queries";
import type { User } from "#/core/auth/types";
import type { ThemePreference } from "#/core/prefs";
import type { Locale } from "#/i18n/locale";
import { createQueryClient } from "#/lib/query-client";
import { parseSearch } from "#/lib/search-params";
import { renderWithProviders } from "./render";

type Options = {
	/** Where `ui` renders (default `/`); `/` then renders a stub home page. */
	path?: string;
	/** The initial URL's query string, e.g. `?userId=u1&secret=s1`. */
	search?: string;
	/** The initial entry's history state, as a reload would restore it. */
	historyState?: Record<string, unknown>;
	/** Seeds the `currentUser` cache, as SSR hydration would. */
	user?: User | null;
	theme?: ThemePreference;
	locale?: Locale;
	/** Renders under a root `<StrictMode>`, which mounts effects twice (as in dev). */
	strictMode?: boolean;
};

/**
 * Renders `ui` at `path` inside a real router whose root mirrors the app's:
 * `beforeLoad` reads the user from the `currentUser` cache into the context,
 * so `useCurrentUser` (and any guard) sees exactly what production would.
 * Every other path renders a stub page, so navigations can be asserted on
 * `router.state.location`.
 */
export async function renderWithRouter(
	ui: ReactElement,
	{
		path = "/",
		search = "",
		historyState,
		user = null,
		theme = "system",
		locale = "en",
		strictMode = false,
	}: Options = {},
) {
	const queryClient = createQueryClient();
	queryClient.setQueryData(currentUserQuery.queryKey, user);

	const rootRoute = createRootRouteWithContext<{
		queryClient: TypedQueryClient;
	}>()({
		beforeLoad: async ({ context }) => ({
			user: await context.queryClient.ensureQueryData(currentUserQuery),
			theme,
			locale,
		}),
		component: Outlet,
	});
	const page = createRoute({
		getParentRoute: () => rootRoute,
		path,
		component: () => ui,
	});
	const home = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <p>Home page</p>,
	});
	const elsewhere = createRoute({
		getParentRoute: () => rootRoute,
		path: "$",
		component: () => <p>Other page</p>,
	});
	const history = createMemoryHistory({ initialEntries: [`${path}${search}`] });
	if (historyState) {
		history.replace(`${path}${search}`, { ...historyState, __TSR_index: 0 });
	}
	const router = createRouter({
		routeTree: rootRoute.addChildren(
			path === "/" ? [page, elsewhere] : [page, home, elsewhere],
		),
		// As in the app: email-link ids stay the strings they were.
		parseSearch,
		history,
		context: { queryClient: asTypedQueryClient(queryClient) },
	});
	const app = <RouterProvider router={router} />;
	if (!strictMode) {
		await router.load();
		const rendered = await renderWithProviders(app, { locale, queryClient });
		return { ...rendered, router };
	}
	// Not preloaded: StrictMode re-runs the effects of components mounted by the
	// router's own first load, but not of a preloaded tree.
	const rendered = await renderWithProviders(<StrictMode>{app}</StrictMode>, {
		locale,
		queryClient,
	});
	// Let the router finish its first load.
	await act(async () => {});
	return { ...rendered, router };
}
