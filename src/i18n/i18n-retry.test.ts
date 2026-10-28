import { expect, it, vi } from "vitest";
import { loadedResources, loadResources } from "./i18n";

const attempts = vi.hoisted(() => ({ count: 0 }));

// The first import of the `it` chunk fails, as a dropped network request would.
vi.mock("./locales/it", async (importOriginal) => {
	attempts.count += 1;
	if (attempts.count === 1) {
		throw new TypeError("Failed to fetch dynamically imported module");
	}
	return importOriginal();
});

it("forgets a failed chunk load so the next call retries", async () => {
	// Vitest wraps errors thrown by a mock factory, so only the rejection is asserted.
	await expect(loadResources("it")).rejects.toThrow();
	expect(loadedResources("it")).toBeUndefined();

	const resources = await loadResources("it");
	expect(resources.auth.login.title).toBe("Accedi");
	expect(loadedResources("it")).toBe(resources);
	expect(attempts.count).toBe(2);
});
