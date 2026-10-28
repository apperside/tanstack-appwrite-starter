import { describe, expect, it } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
	it.each([
		["Ada Lovelace", "AL"],
		["ada", "A"],
		["  Grace  Brewster Hopper ", "GH"],
		["ada@example.test", "A"],
		["élodie durand", "ÉD"],
		["", ""],
	])("%j → %j", (name, expected) => {
		expect(initials(name)).toBe(expected);
	});

	it("keeps astral characters whole", () => {
		expect(initials("𝒜da 𝒷")).toBe("𝒜𝒷");
	});
});
