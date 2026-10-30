import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDocumentTheme } from "./use-document-theme";

const root = document.documentElement;

describe("useDocumentTheme", () => {
	afterEach(() => root.classList.remove("light", "dark"));

	it("reads the class on <html>", () => {
		root.classList.add("dark");
		expect(renderHook(() => useDocumentTheme()).result.current).toBe("dark");
	});

	it("is light without a dark class", () => {
		expect(renderHook(() => useDocumentTheme()).result.current).toBe("light");
	});

	it("follows class changes", async () => {
		root.classList.add("light");
		const { result } = renderHook(() => useDocumentTheme());
		act(() => {
			root.classList.replace("light", "dark");
		});
		await waitFor(() => expect(result.current).toBe("dark"));
	});
});
