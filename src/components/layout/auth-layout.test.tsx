import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { renderWithRouter } from "#/test/router";
import { AuthLayout } from "./auth-layout";

describe("AuthLayout", () => {
	it("renders the title as the page heading, with subtitle, body and footer", async () => {
		const { container } = await renderWithRouter(
			<AuthLayout
				title="Sign in"
				subtitle="Welcome back"
				footer={<p>No account yet?</p>}
			>
				<p>Form goes here</p>
			</AuthLayout>,
		);
		expect(
			screen.getByRole("heading", { level: 1, name: "Sign in" }),
		).toBeInTheDocument();
		expect(screen.getByText("Welcome back")).toBeInTheDocument();
		expect(screen.getByText("Form goes here")).toBeInTheDocument();
		expect(screen.getByText("No account yet?")).toBeInTheDocument();
		expect(screen.getByRole("main")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "My App" })).toHaveAttribute(
			"href",
			"/",
		);
		expect(await axe(container)).toHaveNoViolations();
	});

	it("omits the optional parts", async () => {
		await renderWithRouter(
			<AuthLayout title="Onboarding">
				<p>Body</p>
			</AuthLayout>,
		);
		expect(document.querySelector("footer")).toBeNull();
		expect(
			screen.getByRole("heading", { name: "Onboarding" }),
		).toBeInTheDocument();
	});
});
