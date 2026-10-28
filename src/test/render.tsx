import { type QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { loadI18n } from "#/i18n/i18n";
import type { Locale } from "#/i18n/locale";
import { createQueryClient } from "#/lib/query-client";

type Options = Omit<RenderOptions, "wrapper"> & {
	locale?: Locale;
	/** Defaults to a fresh client with the app defaults. */
	queryClient?: QueryClient;
};

/**
 * Renders `ui` inside the app's providers: a fresh i18next instance for `locale`
 * and a QueryClient (fresh, app defaults, unless given). Use it for every component test.
 */
export async function renderWithProviders(
	ui: ReactElement,
	{
		locale = "en",
		queryClient = createQueryClient(),
		...options
	}: Options = {},
) {
	const i18n = await loadI18n(locale);
	function Providers({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<I18nextProvider i18n={i18n}>{children}</I18nextProvider>
			</QueryClientProvider>
		);
	}
	return {
		user: userEvent.setup(),
		i18n,
		queryClient,
		...render(ui, { wrapper: Providers, ...options }),
	};
}
