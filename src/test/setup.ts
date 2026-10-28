import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import * as axeMatchers from "vitest-axe/matchers";

// vitest-axe's `extend-expect` entry does not reach Vitest 5's `expect`.
expect.extend(axeMatchers);

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => cleanup());

// jsdom has no scrolling; the router's scroll handling calls it on every navigation.
if (typeof window !== "undefined") window.scrollTo = () => {};

// Browser APIs jsdom lacks that Radix (menus, popper) and the shell touch.
if (typeof window !== "undefined") {
	window.ResizeObserver ??= class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
	Element.prototype.scrollIntoView ??= () => {};
	Element.prototype.hasPointerCapture ??= () => false;
	Element.prototype.releasePointerCapture ??= () => {};
}
