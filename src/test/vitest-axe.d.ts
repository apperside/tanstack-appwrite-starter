import "vitest";
import type { AxeMatchers } from "vitest-axe";

// vitest-axe only augments the legacy global `Vi` namespace; Vitest 5 reads the module.
declare module "vitest" {
	// biome-ignore lint/suspicious/noExplicitAny: must match Vitest's own declaration
	interface Assertion<T = any> extends AxeMatchers {}
	interface AsymmetricMatchersContaining extends AxeMatchers {}
}
