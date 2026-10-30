import { describe, expect, it } from "vitest";
import { pageSize } from "./page";

describe("pageSize", () => {
	it.each([
		[undefined, 25],
		[{}, 25],
		[{ limit: 10 }, 10],
		[{ limit: 0 }, 1],
		[{ limit: 2.7 }, 2],
		[{ limit: 1000 }, 100],
	])("reads %j as %j", (request, expected) => {
		expect(pageSize(request)).toBe(expected);
	});
});
