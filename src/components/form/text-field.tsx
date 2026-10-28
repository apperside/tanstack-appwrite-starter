import { Input } from "#/components/ui/input";
import { FieldShell, useFieldControl } from "./field-shell";

export type TextFieldProps = {
	label: string;
	type?: "text" | "email";
	autoComplete: string;
	description?: string;
};

/** A labelled text or email input bound to the surrounding `form.AppField`. */
export function TextField({
	label,
	type = "text",
	autoComplete,
	description,
}: TextFieldProps) {
	const { ids, error, inputProps } = useFieldControl({ description });
	const isEmail = type === "email";
	return (
		<FieldShell ids={ids} label={label} description={description} error={error}>
			<Input
				{...inputProps}
				type={type}
				autoComplete={autoComplete}
				// Mobile keyboards must not capitalize or "correct" an address.
				autoCapitalize={isEmail ? "none" : undefined}
				spellCheck={isEmail ? false : undefined}
			/>
		</FieldShell>
	);
}
