import type { Locale } from "#/core/prefs";
import { readCookie } from "#/lib/cookies";

export type { Locale };

/** Supported locales; the first is the fallback. */
export const LOCALES = ["en", "it"] as const satisfies readonly Locale[];

export const DEFAULT_LOCALE: Locale = LOCALES[0];

/** The client-readable cookie holding the visitor's chosen `Locale`. */
export const LOCALE_COOKIE = "locale";

export function isLocale(value: unknown): value is Locale {
	return (LOCALES as readonly unknown[]).includes(value);
}

/**
 * Language tags of an `Accept-Language` header, best first.
 * Entries with `q=0` or an unparsable weight are dropped; ties keep header order.
 */
function rankLanguages(header: string): string[] {
	return header
		.split(",")
		.map((entry, index) => {
			const [tag, ...params] = entry.trim().split(";");
			const qParam = params.find((param) => param.trim().startsWith("q="));
			const q = qParam === undefined ? 1 : Number(qParam.trim().slice(2));
			return { tag: tag.trim().toLowerCase(), q, index };
		})
		.filter(({ tag, q }) => tag !== "" && tag !== "*" && q > 0)
		.sort((a, b) => b.q - a.q || a.index - b.index)
		.map(({ tag }) => tag);
}

/** The best supported locale of an `Accept-Language` header, matched on the primary subtag. */
function matchAcceptLanguage(header: string): Locale | undefined {
	for (const tag of rankLanguages(header)) {
		const primary = tag.split("-")[0];
		if (isLocale(primary)) return primary;
	}
	return undefined;
}

export type LocaleSources = {
	/** `User.prefs.locale` of the signed-in user. */
	prefsLocale?: string;
	/** The `locale` cookie. */
	cookieLocale?: string;
	/** The `Accept-Language` header (on the client: the SSR-resolved `<html lang>`). */
	acceptLanguage?: string;
};

/** The locale to render: prefs → cookie → best `Accept-Language` match → `en`. Invalid values are skipped. */
export function resolveLocale({
	prefsLocale,
	cookieLocale,
	acceptLanguage,
}: LocaleSources): Locale {
	if (isLocale(prefsLocale)) return prefsLocale;
	if (isLocale(cookieLocale)) return cookieLocale;
	return matchAcceptLanguage(acceptLanguage ?? "") ?? DEFAULT_LOCALE;
}

/**
 * The hints below the account preference on the client: the `locale` cookie,
 * then the locale the server already resolved into `<html lang>`. Re-reading
 * `navigator.languages` instead could disagree with the request's
 * `Accept-Language` and flip the language on the first client navigation.
 */
export function clientLocaleHints(doc: {
	cookie: string;
	documentElement: { lang: string };
}): Omit<LocaleSources, "prefsLocale"> {
	return {
		cookieLocale: readCookie(doc.cookie, LOCALE_COOKIE),
		acceptLanguage: doc.documentElement.lang,
	};
}
