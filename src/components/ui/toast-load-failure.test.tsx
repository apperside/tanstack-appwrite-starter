import { expect, it, vi } from "vitest";
import { toast } from "./toast";

// A dropped network request for the lazily loaded chunk.
vi.mock("sonner", () => {
	throw new TypeError("Failed to fetch dynamically imported module");
});

it("warns instead of leaving an unhandled rejection when sonner fails to load", async () => {
	const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

	toast.error("Saved");

	await vi.waitFor(() =>
		expect(warn).toHaveBeenCalledWith(
			"Toast not shown: sonner failed to load",
			expect.anything(),
		),
	);
});
