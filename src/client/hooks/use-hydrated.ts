import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` on the server and while hydrating, `true` from then on (and on any
 * render after a client-side navigation): render browser-only values (history
 * state, the local time zone) only once it is `true`, so hydration matches.
 */
export function useHydrated(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => true,
		() => false,
	);
}
