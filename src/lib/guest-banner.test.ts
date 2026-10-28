import { describe, expect, it } from "vitest";
import { GUEST_BANNER_COOKIE, parseGuestBannerCookie } from "./guest-banner";

describe("parseGuestBannerCookie", () => {
	it("is dismissed only when the cookie is 1", () => {
		expect(GUEST_BANNER_COOKIE).toBe("guest_banner_dismissed");
		expect(parseGuestBannerCookie("a=1; guest_banner_dismissed=1")).toBe(true);
		expect(parseGuestBannerCookie("guest_banner_dismissed=0")).toBe(false);
		expect(parseGuestBannerCookie("")).toBe(false);
	});
});
