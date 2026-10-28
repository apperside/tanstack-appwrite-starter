import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { TestForm } from "#/test/test-form";

describe("PasswordField", () => {
	it("toggles the input type between password and text", async () => {
		const { user } = await renderWithProviders(<TestForm />);
		const password = screen.getByLabelText("Password");
		const toggle = screen.getByRole("button", { name: "Show password" });
		expect(password).toHaveAttribute("type", "password");
		expect(toggle).toHaveAttribute("aria-pressed", "false");
		expect(toggle).toHaveAttribute("aria-controls", password.id);

		await user.click(toggle);
		expect(password).toHaveAttribute("type", "text");
		expect(toggle).toHaveAttribute("aria-pressed", "true");

		await user.click(toggle);
		expect(password).toHaveAttribute("type", "password");
	});

	it("never submits the form from the toggle", async () => {
		const { user } = await renderWithProviders(<TestForm />);
		await user.click(screen.getByRole("button", { name: "Show password" }));
		expect(screen.queryByText(/valid email/)).not.toBeInTheDocument();
	});

	it("passes autocomplete through", async () => {
		await renderWithProviders(<TestForm />);
		expect(screen.getByLabelText("Password")).toHaveAttribute(
			"autocomplete",
			"new-password",
		);
	});

	it("announces the strength as a translated label", async () => {
		const { user } = await renderWithProviders(<TestForm showStrength />);
		const status = screen.getByTestId("password-strength");
		expect(status).toHaveAttribute("aria-live", "polite");
		expect(status).toBeEmptyDOMElement();

		await user.type(screen.getByLabelText("Password"), "abcdefgh");
		expect(status).toHaveTextContent("Password strength: weak");
		await user.type(screen.getByLabelText("Password"), "A1!");
		expect(status).toHaveTextContent("Password strength: strong");
	});

	it("shows no meter without showStrength", async () => {
		await renderWithProviders(<TestForm />);
		expect(screen.queryByTestId("password-strength")).not.toBeInTheDocument();
	});

	it("translates the toggle and the meter", async () => {
		const { user } = await renderWithProviders(<TestForm showStrength />, {
			locale: "it",
		});
		await user.type(screen.getByLabelText("Password"), "abc");
		expect(screen.getByTestId("password-strength")).toHaveTextContent(
			"Robustezza della password: troppo debole",
		);
		expect(
			screen.getByRole("button", { name: "Mostra password" }),
		).toBeInTheDocument();
	});
});

it("submits with Enter from a field that was never blurred", async () => {
	const onSubmit = vi.fn(async () => {});
	const { user } = await renderWithProviders(<TestForm onSubmit={onSubmit} />);
	await user.type(screen.getByLabelText("Email"), "ada@example.com");
	await user.type(screen.getByLabelText("Password"), "correct horse{Enter}");
	await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
	expect(
		screen.queryByText("Use at least 8 characters"),
	).not.toBeInTheDocument();
});
