import { createFormHookContexts } from "@tanstack/react-form";

// Separate from form-kit.ts so the field and form components can read the
// contexts without importing the hook that registers them (no import cycle).
export const { fieldContext, formContext, useFieldContext, useFormContext } =
	createFormHookContexts();
