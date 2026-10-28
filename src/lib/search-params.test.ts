import { describe, expect, it } from "vitest";
import { parseSearch } from "./search-params";

describe("parseSearch", () => {
	it("keeps a value whose JSON reading would change it (an id like 65e12)", () => {
		expect(parseSearch("?userId=65e12&secret=0e1")).toEqual({
			userId: "65e12",
			secret: "0e1",
		});
	});

	it("still reads numbers, booleans and quoted strings that round-trip", () => {
		expect(
			parseSearch(
				"?upgrade=1&on=true&name=%22ann%22&n=42&redirect=%2Fx%3Fa%3D1",
			),
		).toEqual({ upgrade: 1, on: true, name: "ann", n: 42, redirect: "/x?a=1" });
	});

	it("keeps JSON objects", () => {
		expect(parseSearch("?filter=%7B%22a%22%3A1%7D")).toEqual({
			filter: { a: 1 },
		});
	});
});
