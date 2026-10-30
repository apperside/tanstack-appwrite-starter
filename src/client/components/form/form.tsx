import type { ComponentProps, FormEvent } from "react";
import { useRef } from "react";
import { cn } from "#/lib/cn";
import { useFormContext } from "./form-context";
import { withServerErrors } from "./server-errors";

/**
 * The `<form>` element of an app form. It submits through TanStack Form, ignores
 * re-submits while one is in flight (a double click or Enter lands before the
 * button re-renders disabled), shows anything `onSubmit` throws via
 * `withServerErrors`, and moves focus to the first invalid field.
 */
export function Form({
	className,
	children,
	...props
}: Omit<ComponentProps<"form">, "onSubmit" | "noValidate">) {
	const form = useFormContext();
	const ref = useRef<HTMLFormElement>(null);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		event.stopPropagation();
		if (form.state.isSubmitting) return;
		form.setErrorMap({ onServer: undefined });
		try {
			await form.handleSubmit();
		} catch (error) {
			withServerErrors(form, error);
		}
		// Validation or a server error mapped to a field: take the user there,
		// once React has rendered the new aria-invalid attributes.
		requestAnimationFrame(() =>
			ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
		);
	}

	return (
		<form
			ref={ref}
			noValidate
			onSubmit={(event) => void submit(event)}
			className={cn("grid gap-4", className)}
			{...props}
		>
			{children}
		</form>
	);
}
