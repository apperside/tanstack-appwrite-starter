import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { TestForm } from "#/test/test-form";

describe("SubmitButton", () => {
	it("submits once on a double click and is disabled while pending", async () => {
		let resolve = () => {};
		const pending = new Promise<void>((done) => {
			resolve = done;
		});
		const onSubmit = vi.fn(() => pending);
		const { user } = await renderWithProviders(
			<TestForm onSubmit={onSubmit} />,
		);
		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.type(screen.getByLabelText("Password"), "correct horse");

		const button = screen.getByRole("button", { name: "Submit" });
		await user.dblClick(button);

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(button).toBeDisabled();
		expect(button.querySelector("svg")).toHaveClass("animate-spin");

		await user.keyboard("{Enter}");
		resolve();
		await waitFor(() => expect(button).toBeEnabled());
		expect(onSubmit).toHaveBeenCalledTimes(1);
		expect(onSubmit).toHaveBeenCalledWith({
			email: "ada@example.com",
			password: "correct horse",
		});
	});

	it("ignores a second submit event fired before React re-renders", async () => {
		const onSubmit = vi.fn(() => new Promise<void>(() => {}));
		const { user } = await renderWithProviders(
			<TestForm onSubmit={onSubmit} />,
		);
		await user.type(screen.getByLabelText("Email"), "ada@example.com");
		await user.type(screen.getByLabelText("Password"), "correct horse");

		const form = screen.getByRole("form", { name: "Test form" });
		fireEvent.submit(form);
		fireEvent.submit(form);
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
	});

	it("is a 44px-tall submit button", async () => {
		await renderWithProviders(<TestForm />);
		const button = screen.getByRole("button", { name: "Submit" });
		expect(button).toHaveAttribute("type", "submit");
		expect(button).toHaveClass("min-h-11");
	});
});
