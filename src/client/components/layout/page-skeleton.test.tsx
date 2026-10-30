import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { renderWithProviders } from "#/test/render";
import { PageSkeleton } from "./page-skeleton";

describe("PageSkeleton", () => {
	it.each([
		"form",
		"list",
		"card",
	] as const)("announces loading for the %s variant", async (variant) => {
		const { container } = await renderWithProviders(
			<PageSkeleton variant={variant} />,
		);
		const status = screen.getByRole("status", { name: "Loading…" });
		expect(status).toHaveAttribute("aria-busy", "true");
		expect(status).toHaveAttribute("data-variant", variant);
		expect(await axe(container)).toHaveNoViolations();
	});

	it("defaults to the card variant (the router's pending component)", async () => {
		await renderWithProviders(<PageSkeleton />);
		expect(screen.getByRole("status")).toHaveAttribute("data-variant", "card");
	});

	it("renders identically on every render (no random widths)", () => {
		const first = render(<PageSkeleton variant="list" />).container.innerHTML;
		const second = render(<PageSkeleton variant="list" />).container.innerHTML;
		expect(first).toBe(second);
	});
});
