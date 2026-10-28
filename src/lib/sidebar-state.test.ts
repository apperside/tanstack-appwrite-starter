import { describe, expect, it } from "vitest";
import { parseSidebarCookie, SIDEBAR_COOKIE } from "./sidebar-state";

describe("parseSidebarCookie", () => {
	it("reads expanded and collapsed", () => {
		expect(SIDEBAR_COOKIE).toBe("sidebar_state");
		expect(parseSidebarCookie("a=1; sidebar_state=collapsed")).toBe(
			"collapsed",
		);
		expect(parseSidebarCookie("sidebar_state=expanded")).toBe("expanded");
	});

	it("falls back to auto when missing or invalid (incl. the kit's old true/false)", () => {
		expect(parseSidebarCookie("")).toBe("auto");
		expect(parseSidebarCookie("sidebar_state=true")).toBe("auto");
		expect(parseSidebarCookie("sidebar_state=auto")).toBe("auto");
	});
});
