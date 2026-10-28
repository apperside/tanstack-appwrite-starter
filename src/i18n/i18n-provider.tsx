import { type ReactNode, use, useMemo } from "react";
import { I18nextProvider } from "react-i18next";
import { createI18n, loadedResources, loadResources } from "./i18n";
import type { Locale } from "./locale";

/**
 * Provides an i18next instance for the SSR-resolved `locale`.
 * The root `beforeLoad` preloads the resources, so the server and client
 * navigations render synchronously; only hydration may suspend once while the
 * locale chunk arrives, keeping the server HTML on screen (no mismatch).
 */
export function I18nProvider({
	locale,
	children,
}: {
	locale: Locale;
	children: ReactNode;
}) {
	const resources = loadedResources(locale) ?? use(loadResources(locale));
	const i18n = useMemo(
		() => createI18n(locale, resources),
		[locale, resources],
	);
	return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
