import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AppError } from "#/lib/errors";
import { renderWithRouter } from "#/test/router";
import { RouteError } from "./route-error";

const NETWORK_MESSAGE =
	"Can't reach the server. Check your connection and try again.";

describe("RouteError", () => {
	it("shows the translated message of the error's code", async () => {
		await renderWithRouter(
			<RouteError error={new AppError("NETWORK")} reset={() => {}} />,
		);
		expect(
			screen.getByRole("heading", { name: "Something went wrong" }),
		).toBeInTheDocument();
		expect(screen.getByText(NETWORK_MESSAGE)).toBeInTheDocument();
	});

	it("normalizes raw errors (a failed fetch reads as NETWORK)", async () => {
		await renderWithRouter(
			<RouteError error={new TypeError("Failed to fetch")} reset={() => {}} />,
		);
		expect(screen.getByText(NETWORK_MESSAGE)).toBeInTheDocument();
	});

	it("never leaks a raw message", async () => {
		await renderWithRouter(
			<RouteError error={new Error("SQL syntax near 'x'")} reset={() => {}} />,
		);
		expect(screen.queryByText(/SQL/)).not.toBeInTheDocument();
		expect(
			screen.getByText(
				"Something went wrong on our side. Please try again in a moment.",
			),
		).toBeInTheDocument();
	});

	it("retries by invalidating the router", async () => {
		const { user, router } = await renderWithRouter(
			<RouteError error={new AppError("NETWORK")} reset={() => {}} />,
		);
		const invalidate = vi.spyOn(router, "invalidate");
		await user.click(screen.getByRole("button", { name: "Try again" }));
		expect(invalidate).toHaveBeenCalledTimes(1);
	});

	it("is translated and accessible", async () => {
		const { container } = await renderWithRouter(
			<RouteError error={new AppError("NETWORK")} reset={() => {}} />,
			{ locale: "it" },
		);
		expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
		expect(await axe(container)).toHaveNoViolations();
	});

	it("announces only the message, inside a main landmark", async () => {
		await renderWithRouter(
			<RouteError error={new AppError("NETWORK")} reset={() => {}} />,
		);
		expect(screen.getByRole("alert")).toHaveTextContent(NETWORK_MESSAGE);
		expect(screen.getByRole("alert")).not.toHaveTextContent("Try again");
		expect(screen.getByRole("main")).toBeInTheDocument();
	});
});
