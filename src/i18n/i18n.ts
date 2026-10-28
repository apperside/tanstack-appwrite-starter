import { createInstance, type i18n } from "i18next";
import { LOCALES, type Locale } from "./locale";
import type enResources from "./locales/en";

/** All namespaces of one locale; `en` is the source of truth for keys (see `i18next.d.ts`). */
export type Resources = typeof enResources;

/** Each locale is its own chunk, so only the active language is ever downloaded. */
const LOADERS: Record<Locale, () => Promise<{ default: Resources }>> = {
	en: () => import("./locales/en"),
	it: () => import("./locales/it"),
};

// Module-level caches hold immutable translation data only (never an i18next
// instance), so sharing them across server requests is safe.
const pending = new Map<Locale, Promise<Resources>>();
const loaded = new Map<Locale, Resources>();

/** Loads one locale's namespaces once; a failed chunk load can be retried. */
export function loadResources(locale: Locale): Promise<Resources> {
	let promise = pending.get(locale);
	if (!promise) {
		promise = LOADERS[locale]().then(
			({ default: resources }) => {
				loaded.set(locale, resources);
				return resources;
			},
			(error: unknown) => {
				pending.delete(locale);
				throw error;
			},
		);
		pending.set(locale, promise);
	}
	return promise;
}

/**
 * Seeds the cache with resources the server already sent (dehydrated with the
 * page), so hydration never waits for the locale chunk.
 */
export function primeResources(locale: Locale, resources: Resources): void {
	loaded.set(locale, resources);
	pending.set(locale, Promise.resolve(resources));
}

/** The resources of `locale` if already loaded, for synchronous instance creation. */
export function loadedResources(locale: Locale): Resources | undefined {
	return loaded.get(locale);
}

/**
 * A fresh, synchronously initialized instance holding only `locale`'s resources.
 * Never shared: the server creates one per request, the client one per locale.
 */
export function createI18n(locale: Locale, resources: Resources): i18n {
	const instance = createInstance({
		lng: locale,
		supportedLngs: LOCALES,
		fallbackLng: false,
		resources: { [locale]: resources },
		ns: Object.keys(resources),
		defaultNS: "common",
		interpolation: { escapeValue: false }, // React already escapes.
		returnEmptyString: false,
		initAsync: false,
	});
	void instance.init();
	return instance;
}

/** Loads `locale` and returns a new instance for it (one per server request). */
export async function loadI18n(locale: Locale): Promise<i18n> {
	return createI18n(locale, await loadResources(locale));
}
