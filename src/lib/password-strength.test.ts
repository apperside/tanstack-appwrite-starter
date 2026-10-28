import { describe, expect, it } from "vitest";
import { scorePassword } from "./password-strength";

describe("scorePassword", () => {
	it.each([
		["", 0],
		["Ab1!", 0], // under 8 characters never counts, whatever its variety
		["abcdefgh", 1],
		["abcdefghijkl", 2],
		["Abcdefgh", 2],
		["abcdefg1", 2],
		["abcdefg!", 2],
		["Abcdefg1", 3],
		["Abcdefgh1!", 4], // 1 + mixed + digit + symbol
		["Abcdefghijk1!", 4], // capped
		["ÀBCDEFGHè", 2], // non-ASCII letters count as mixed case
		["abcdefgh ", 2], // a space is a symbol
	] as const)("scores %j as %i", (password, expected) => {
		expect(scorePassword(password)).toBe(expected);
	});
});
