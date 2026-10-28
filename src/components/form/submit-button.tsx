import { useStore } from "@tanstack/react-form";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/cn";
import { useFormContext } from "./form-context";

/**
 * The form's submit button: disabled with a spinner while submitting. Full
 * width and 44px tall unless `className` says otherwise (coarse pointers keep
 * 44px whatever it says).
 */
export function SubmitButton({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	const form = useFormContext();
	const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
	return (
		<Button
			type="submit"
			disabled={isSubmitting}
			className={cn("min-h-11 w-full", className)}
		>
			{isSubmitting && <Loader2Icon aria-hidden className="animate-spin" />}
			{children}
		</Button>
	);
}
