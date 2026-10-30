import { expect, it, vi } from "vitest";
import { createConsoleTransport } from "./console.server";

it("logs the recipient and the link", async () => {
	const info = vi.spyOn(console, "info").mockImplementation(() => {});
	await createConsoleTransport().send({
		to: "ann@example.test",
		from: "",
		subject: "Hi",
		text: "Open https://app.test/x?token=t now",
		html: "",
	});
	expect(info).toHaveBeenCalledTimes(1);
	const line = String(info.mock.calls[0]?.[0]);
	expect(line).toContain("ann@example.test");
	expect(line).toContain("https://app.test/x?token=t");
	info.mockRestore();
});
