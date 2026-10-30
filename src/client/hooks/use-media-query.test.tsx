import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./use-media-query";

function stubMatchMedia(initial: boolean) {
	const listeners = new Set<() => void>();
	const mql = {
		matches: initial,
		addEventListener: (_: string, fn: () => void) => listeners.add(fn),
		removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
	};
	vi.stubGlobal(
		"matchMedia",
		vi.fn(() => mql),
	);
	return {
		listeners,
		set(matches: boolean) {
			mql.matches = matches;
			for (const fn of listeners) fn();
		},
	};
}

function Probe() {
	return <>{String(useMediaQuery("(min-width: 1024px)"))}</>;
}

describe("useMediaQuery", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("follows the query and unsubscribes", () => {
		const media = stubMatchMedia(true);
		const { result, unmount } = renderHook(() =>
			useMediaQuery("(min-width: 1024px)"),
		);
		expect(window.matchMedia).toHaveBeenCalledWith("(min-width: 1024px)");
		expect(result.current).toBe(true);
		act(() => media.set(false));
		expect(result.current).toBe(false);
		unmount();
		expect(media.listeners.size).toBe(0);
	});

	it("is false on the server", () => {
		stubMatchMedia(true);
		expect(renderToString(<Probe />)).toBe("false");
	});
});
