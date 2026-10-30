import { lazy, Suspense, useEffect, useState } from "react";

/**
 * Toasts without sonner in the initial bundle: the first `toast.*` call loads
 * sonner and mounts the Toaster. Sonner replays toasts created before its
 * Toaster subscribed, so none is lost.
 */

const Toaster = lazy(() =>
	import("./sonner").then((module) => ({ default: module.Toaster })),
);

let requested = false;
let mountToaster: (() => void) | undefined;

function notify(kind: "success" | "error", message: string) {
	requested = true;
	mountToaster?.();
	import("sonner").then(
		({ toast }) => toast[kind](message),
		(error: unknown) =>
			console.warn("Toast not shown: sonner failed to load", error),
	);
}

export const toast = {
	success: (message: string) => notify("success", message),
	error: (message: string) => notify("error", message),
};

/** Mount once, in the root layout. Renders nothing until the first toast. */
export function Toasts() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		mountToaster = () => setMounted(true);
		if (requested) setMounted(true);
		return () => {
			mountToaster = undefined;
		};
	}, []);
	if (!mounted) return null;
	return (
		<Suspense fallback={null}>
			<Toaster />
		</Suspense>
	);
}
