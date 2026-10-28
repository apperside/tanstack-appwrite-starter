import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether `query` matches, kept in sync. `false` on the server and during
 * hydration, so never use it for layout: style that with CSS media queries.
 */
export function useMediaQuery(query: string): boolean {
	const subscribe = useCallback(
		(onChange: () => void) => {
			const mql = window.matchMedia(query);
			mql.addEventListener("change", onChange);
			return () => mql.removeEventListener("change", onChange);
		},
		[query],
	);
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(query).matches,
		() => false,
	);
}
