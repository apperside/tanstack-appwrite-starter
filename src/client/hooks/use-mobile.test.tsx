import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "./use-mobile";

function mockViewport(width: number) {
	const listeners = new Set<() => void>();
	vi.stubGlobal("innerWidth", width);
	vi.stubGlobal(
		"matchMedia",
		vi.fn((query: string) => ({
			media: query,
			addEventListener: (_: string, fn: () => void) => listeners.add(fn),
			removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
		})),
	);
	return {
		listeners,
		resize(next: number) {
			vi.stubGlobal("innerWidth", next);
			for (const fn of listeners) fn();
		},
	};
}

describe("useIsMobile", () => {
	afterEach(() => vi.unstubAllGlobals());

	it("is true below 768px and false from 768px", () => {
		mockViewport(767);
		expect(renderHook(() => useIsMobile()).result.current).toBe(true);
		mockViewport(768);
		expect(renderHook(() => useIsMobile()).result.current).toBe(false);
	});

	it("queries the breakpoint and follows changes, then unsubscribes", () => {
		const viewport = mockViewport(1024);
		const { result, unmount } = renderHook(() => useIsMobile());
		expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
		act(() => viewport.resize(500));
		expect(result.current).toBe(true);
		unmount();
		expect(viewport.listeners.size).toBe(0);
	});
});
