import { useSyncExternalStore } from "react";

type DocumentTheme = "light" | "dark";

function subscribe(onChange: () => void) {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, { attributeFilter: ["class"] });
	return () => observer.disconnect();
}

const getSnapshot = (): DocumentTheme =>
	document.documentElement.classList.contains("dark") ? "dark" : "light";

const getServerSnapshot = (): DocumentTheme => "light";

/**
 * The theme painted on `<html>` (set by the server or the theme script), kept in
 * sync as the class changes, e.g. when `system` follows an OS switch.
 */
export function useDocumentTheme(): DocumentTheme {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
