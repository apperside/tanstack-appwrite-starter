import { z } from "zod/mini";
import { NAME_MAX_LENGTH, nameSchema } from "../auth/auth.schemas";

export const completeOnboardingSchema = z.object({
	name: z.optional(nameSchema),
});

export type CompleteOnboardingInput = z.output<typeof completeOnboardingSchema>;

/** The onboarding form: the name may be left empty (a guest may have none). */
export const onboardingFormSchema = z.object({
	name: z.string().check(z.trim(), z.maxLength(NAME_MAX_LENGTH)),
});
