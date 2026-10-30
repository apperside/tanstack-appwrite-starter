import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import { TestForm } from "#/test/test-form";
import { useAppForm } from "./form-kit";

const EMAIL_ERROR = "Enter a valid email address";

describe("TextField", () => {
	it("shows an invalid email's error only after blur", async () => {
		const { user } = await renderWithProviders(<TestForm />);
		const email = screen.getByLabelText("Email");

		await user.type(email, "nope");
		expect(screen.queryByText(EMAIL_ERROR)).not.toBeInTheDocument();
		expect(email).not.toHaveAttribute("aria-invalid");

		await user.tab();
		const error = screen.getByText(EMAIL_ERROR);
		expect(email).toHaveAttribute("aria-invalid", "true");
		expect(email.getAttribute("aria-describedby")).toContain(error.id);
	});

	it("revalidates on change once the field shows an error", async () => {
		const { user } = await renderWithProviders(<TestForm />);
		const email = screen.getByLabelText("Email");
		await user.type(email, "a@b");
		await user.tab();
		expect(screen.getByText(EMAIL_ERROR)).toBeInTheDocument();

		await user.type(email, ".io");
		expect(screen.queryByText(EMAIL_ERROR)).not.toBeInTheDocument();
		expect(email).not.toHaveAttribute("aria-invalid");
	});

	it("waits for the next blur once the error is fixed", async () => {
		const { user } = await renderWithProviders(<TestForm />);
		const email = screen.getByLabelText("Email");
		await user.type(email, "a@b.io");
		await user.tab();
		await user.clear(email);
		await user.type(email, "x");
		expect(screen.queryByText(EMAIL_ERROR)).not.toBeInTheDocument();
	});

	it("wires the description and autocomplete", async () => {
		await renderWithProviders(<TestForm />);
		const email = screen.getByLabelText("Email");
		expect(email).toHaveAccessibleDescription("We never share it.");
		expect(email).toHaveAttribute("autocomplete", "email");
		expect(email).toHaveAttribute("type", "email");
	});

	it("translates validation messages", async () => {
		const { user } = await renderWithProviders(<TestForm />, { locale: "it" });
		await user.type(screen.getByLabelText("Email"), "nope");
		await user.tab();
		expect(
			screen.getByText("Inserisci un indirizzo email valido"),
		).toBeVisible();
	});
});

function NameForm() {
	const form = useAppForm({ defaultValues: { name: "Ada" } });
	return (
		<form.AppField name="name">
			{(field) => <field.TextField label="Name" autoComplete="name" />}
		</form.AppField>
	);
}

it("defaults to a plain text input with no description", async () => {
	await renderWithProviders(<NameForm />);
	const name = screen.getByLabelText("Name");
	expect(name).toHaveAttribute("type", "text");
	expect(name).toHaveValue("Ada");
	expect(name).not.toHaveAttribute("aria-describedby");
	expect(name).not.toHaveAttribute("autocapitalize");
});
