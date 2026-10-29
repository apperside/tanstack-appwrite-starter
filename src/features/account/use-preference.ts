import { useRouteContext, useRouter } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "tanstack-query-typed";
import { toast } from "#/components/ui/toast";
import type { AppPrefs } from "#/core/prefs";
import { currentUserQuery } from "#/features/auth/auth.queries";
import { toAppError } from "#/lib/errors";
import { applyTheme } from "#/lib/theme";
import { updatePreferencesMutation } from "./account.mutations";

type PreferenceKey = "theme" | "locale";
/** The preferences the root route resolves into its context. */
type Resolved = Pick<AppPrefs, PreferenceKey>;

/**
 * A preference the root route resolves into its context (`theme`, `locale`)
 * and an optimistic setter. Setting one applies it at once: the cached user's
 * prefs and the root context (re-resolved from those prefs, so the theme
 * repaints and the UI re-renders in the new language without a reload). Then
 * it saves it to the account, whose response also writes the first-paint
 * cookie (only the server writes it, R39), and, if saving fails, puts the last
 * saved value back. Only the latest change counts: a stale save, answering
 * late or failing, never overrides a newer choice.
 */
function usePreference<K extends PreferenceKey>(
	key: K,
	/** Applies the value outside React, before the context catches up. */
	paintNow?: (value: Resolved[K]) => void,
) {
	const resolved: Resolved = useRouteContext({
		from: "__root__",
	});
	const value = resolved[key];
	// The last choice, shown until the context catches up with it (re-resolving
	// may load a locale chunk): `base` is the context value it was made over.
	const [chosen, setChosen] = useState<{
		value: Resolved[K];
		base: Resolved[K];
	} | null>(null);
	const shown = chosen && chosen.base === value ? chosen.value : value;
	// What the context says now, for a rollback that lands after it moved on.
	const latestValue = useRef(value);
	latestValue.current = value;
	const router = useRouter();
	const queryClient = useQueryClient();
	const { t } = useTranslation(["common", "errors"]);
	const { mutateAsync } = useMutation(updatePreferencesMutation);
	const latestChange = useRef(0);
	// The last value the account is known to hold: what a failure rolls back to
	// (the value on screen may be another, still unsaved, choice).
	const confirmed = useRef({ value, change: 0 });

	const set = useCallback(
		(next: Resolved[K]) => {
			const cache = (pref: Resolved[K]) =>
				queryClient.setQueryData(
					currentUserQuery.queryKey,
					(user) => user && { ...user, prefs: { ...user.prefs, [key]: pref } },
				);
			const apply = (pref: Resolved[K]) => {
				setChosen({ value: pref, base: latestValue.current });
				paintNow?.(pref);
				cache(pref);
				// The root `beforeLoad` re-resolves both from the cached prefs
				// first, so the context follows.
				void router.invalidate();
			};
			const change = ++latestChange.current;
			const isLatest = () => change === latestChange.current;
			apply(next);
			mutateAsync({ [key]: next }).then(
				(prefs) => {
					// The save merged `next` in, so the key is there.
					const saved = (prefs[key] ?? next) as Resolved[K];
					if (change > confirmed.current.change) {
						confirmed.current = { value: saved, change };
					}
					if (isLatest()) cache(saved);
				},
				(error: unknown) => {
					if (!isLatest()) return;
					apply(confirmed.current.value);
					toast.error(t(toAppError(error).i18nKey));
				},
			);
		},
		[key, paintNow, router, queryClient, mutateAsync, t],
	);

	return [shown, set] as const;
}

/** The theme preference and its optimistic setter (see `usePreference`). */
export function useThemePreference() {
	return usePreference("theme", applyTheme);
}

/** The UI language and its optimistic setter (see `usePreference`). */
export function useLocalePreference() {
	return usePreference("locale");
}
