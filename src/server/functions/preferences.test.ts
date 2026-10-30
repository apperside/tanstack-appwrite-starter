import { describe, expect, it, vi } from "vitest";
import {
	getGuestBannerDismissed,
	getSidebarMode,
	getThemePreference,
} from "./preferences";

// Outside Start's compiler `createIsomorphicFn` runs its server branch.
const header = vi.hoisted(() => ({ value: "" }));
vi.mock("#/server/cookies/preference-cookies.server", () => ({
	requestCookieHeader: () => header.value,
}));

describe("preferences from the Cookie header", () => {
	it("parses each preference from the same header", async () => {
		header.value =
			"theme=dark; sidebar_state=collapsed; guest_banner_dismissed=1";
		await expect(getThemePreference()).resolves.toBe("dark");
		await expect(getSidebarMode()).resolves.toBe("collapsed");
		await expect(getGuestBannerDismissed()).resolves.toBe(true);
	});

	it("falls back to the defaults without cookies", async () => {
		header.value = "";
		await expect(getThemePreference()).resolves.toBe("system");
		await expect(getSidebarMode()).resolves.toBe("auto");
		await expect(getGuestBannerDismissed()).resolves.toBe(false);
	});
});
