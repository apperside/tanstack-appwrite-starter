import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
	it("joins conditional classes", () => {
		expect(cn("a", false && "b", { c: true, d: false }, ["e"])).toBe("a c e");
	});

	it("lets later Tailwind utilities win, including theme tokens", () => {
		expect(cn("px-2 bg-primary", "px-4 bg-muted")).toBe("px-4 bg-muted");
		expect(cn("text-sm text-muted-foreground", "text-destructive")).toBe(
			"text-sm text-destructive",
		);
	});
});
