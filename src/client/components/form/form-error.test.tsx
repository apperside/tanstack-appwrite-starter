import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "#/lib/errors";
import { renderWithProviders } from "#/test/render";
import { TestForm } from "#/test/test-form";

async function submitValid(
	user: Awaited<ReturnType<typeof renderWithProviders>>["user"],
) {
	await user.type(screen.getByLabelText("Email"), "ada@example.com");
	await user.type(screen.getByLabelText("Password"), "correct horse");
	await user.click(screen.getByRole("button", { name: /Submit/ }));
}

describe("withServerErrors + FormError", () => {
	it("puts a mapped code's translated message on its field and focuses it", async () => {
		const { user } = await renderWithProviders(
			<TestForm
				onSubmit={() => Promise.reject(new AppError("EMAIL_TAKEN"))}
				fieldForCode={{ EMAIL_TAKEN: "email" }}
			/>,
		);
		await submitValid(user);

		const email = screen.getByLabelText("Email");
		const message = await screen.findByText(
			"An account with this email already exists. Sign in instead, or use a different email.",
		);
		expect(email).toHaveAttribute("aria-invalid", "true");
		expect(email.getAttribute("aria-describedby")).toContain(message.id);
		await waitFor(() => expect(email).toHaveFocus());
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();

		// Leaving the field without editing it keeps the server's answer.
		await user.tab();
		expect(message).toHaveTextContent(
			"An account with this email already exists.",
		);
		expect(email).toHaveAttribute("aria-invalid", "true");

		await user.type(email, "x");
		expect(message).toBeEmptyDOMElement();
		expect(email).not.toHaveAttribute("aria-invalid");
	});

	it("shows an unmapped error as a translated form alert", async () => {
		const { user } = await renderWithProviders(
			<TestForm
				onSubmit={() => Promise.reject(new AppError("RATE_LIMITED"))}
			/>,
			{ locale: "it" },
		);
		await submitValid(user);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Troppi tentativi. Attendi qualche minuto e riprova.",
		);
	});

	it("clears the form alert on the first edit", async () => {
		const { user } = await renderWithProviders(
			<TestForm
				onSubmit={() => Promise.reject(new AppError("RATE_LIMITED"))}
			/>,
		);
		await submitValid(user);
		await screen.findByRole("alert");
		// Visiting a field without editing it keeps the alert.
		await user.click(screen.getByLabelText("Email"));
		await user.tab();
		expect(screen.getByRole("alert")).toBeInTheDocument();

		await user.type(screen.getByLabelText("Password"), "!");
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("clears the form alert on an edit that makes the form invalid", async () => {
		const { user } = await renderWithProviders(
			<TestForm
				onSubmit={() => Promise.reject(new AppError("RATE_LIMITED"))}
			/>,
		);
		await submitValid(user);
		await screen.findByRole("alert");
		await user.clear(screen.getByLabelText("Password"));
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
		await user.tab();
		expect(await screen.findByText("Use at least 8 characters")).toBeVisible();
		expect(screen.queryByRole("alert")).not.toBeInTheDocument();
	});

	it("normalizes anything thrown, even from onSubmit itself", async () => {
		const onSubmit = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"));
		const { user } = await renderWithProviders(
			<TestForm onSubmit={onSubmit} />,
		);
		await submitValid(user);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Can't reach the server.",
		);

		await user.click(screen.getByRole("button", { name: /Submit/ }));
		await waitFor(() =>
			expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
		);
		expect(onSubmit).toHaveBeenCalledTimes(2);
	});

	it("shows an error that escapes onSubmit as the form error", async () => {
		const { user } = await renderWithProviders(
			<TestForm
				catchErrors={false}
				onSubmit={() => Promise.reject(new AppError("FORBIDDEN"))}
			/>,
		);
		await submitValid(user);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"You don't have permission to do this.",
		);
		expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
	});

	it("falls back to the form when the mapped field does not exist", async () => {
		const { user } = await renderWithProviders(
			<TestForm
				onSubmit={() => Promise.reject(new AppError("WEAK_PASSWORD"))}
				fieldForCode={{ WEAK_PASSWORD: "missing" }}
			/>,
		);
		await submitValid(user);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"This password is too easy to guess.",
		);
	});
});
