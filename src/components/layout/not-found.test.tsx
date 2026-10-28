import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { renderWithRouter } from "#/test/router";
import { MainLandmark } from "./main-landmark";
import { NotFound } from "./not-found";

describe("NotFound", () => {
	it("explains and links home", async () => {
		const { container } = await renderWithRouter(<NotFound />);
		expect(
			screen.getByRole("heading", { name: "Page not found" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute(
			"href",
			"/",
		);
		expect(await axe(container)).toHaveNoViolations();
	});

	it("is the page's main landmark outside the app shell", async () => {
		await renderWithRouter(<NotFound />);
		expect(screen.getByRole("main")).toHaveTextContent("Page not found");
	});

	it("adds no second main landmark inside one", async () => {
		await renderWithRouter(
			<MainLandmark>
				<NotFound />
			</MainLandmark>,
		);
		expect(screen.getAllByRole("main")).toHaveLength(1);
	});
});
