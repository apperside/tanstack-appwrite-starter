import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Toasts, toast } from "./toast";

describe("toast", () => {
	it("renders nothing until the first toast, then shows it", async () => {
		const { container } = render(<Toasts />);
		expect(container).toBeEmptyDOMElement();

		act(() => toast.success("Saved"));

		expect(await screen.findByText("Saved")).toBeInTheDocument();
	});
});
