import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { AppError } from "#/lib/errors";
import { renderWithProviders } from "#/test/render";
import { TestForm } from "#/test/test-form";

describe("form kit", () => {
	it("has no axe violations at rest", async () => {
		const { container } = await renderWithProviders(<TestForm showStrength />);
		expect(await axe(container)).toHaveNoViolations();
	});

	it("has no axe violations with field and form errors shown", async () => {
		const { container, user } = await renderWithProviders(
			<TestForm
				showStrength
				onSubmit={() => Promise.reject(new AppError("UNKNOWN"))}
			/>,
		);
		await user.type(screen.getByLabelText("Password"), "short");
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await screen.findByText("Use at least 8 characters");
		expect(await axe(container)).toHaveNoViolations();

		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.type(screen.getByLabelText("Password"), "123");
		await user.click(screen.getByRole("button", { name: "Submit" }));
		await screen.findByRole("alert");
		expect(await axe(container)).toHaveNoViolations();
	});

	it("validates everything on submit and focuses the first invalid field", async () => {
		const onSubmit = vi.fn(async () => {});
		const { user } = await renderWithProviders(
			<TestForm onSubmit={onSubmit} />,
		);
		await user.click(screen.getByRole("button", { name: "Submit" }));

		expect(
			await screen.findByText("Enter a valid email address"),
		).toBeVisible();
		expect(screen.getByText("Use at least 8 characters")).toBeVisible();
		await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("renders a native form that skips browser validation bubbles", async () => {
		await renderWithProviders(<TestForm />);
		expect(screen.getByRole("form", { name: "Test form" })).toHaveAttribute(
			"novalidate",
		);
	});
});
