import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/client/components/ui/button";
import { Input } from "#/client/components/ui/input";
import { cn } from "#/lib/cn";
import { type PasswordScore, scorePassword } from "#/lib/password-strength";
import { FieldShell, useFieldControl } from "./field-shell";

export type PasswordFieldProps = {
	label: string;
	autoComplete: "current-password" | "new-password";
	/** Shows a strength meter; use it with `new-password` only. */
	showStrength?: boolean;
};

const SEGMENTS = [1, 2, 3, 4] as const;

const SEGMENT_FILL: Record<PasswordScore, string> = {
	0: "bg-destructive",
	1: "bg-destructive",
	2: "bg-muted-foreground",
	3: "bg-primary",
	4: "bg-primary",
};

/** A password input with a show/hide toggle and an optional strength meter. */
export function PasswordField({
	label,
	autoComplete,
	showStrength = false,
}: PasswordFieldProps) {
	const { t } = useTranslation();
	const { ids, error, value, inputProps } = useFieldControl({});
	const [visible, setVisible] = useState(false);

	return (
		<FieldShell ids={ids} label={label} error={error}>
			<div className="relative">
				<Input
					{...inputProps}
					type={visible ? "text" : "password"}
					autoComplete={autoComplete}
					autoCapitalize="none"
					spellCheck={false}
					className="pr-10 pointer-coarse:pr-12"
				/>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="text-muted-foreground absolute inset-y-0 right-0 h-full rounded-l-none"
					aria-label={t("form.showPassword")}
					aria-pressed={visible}
					aria-controls={ids.input}
					onClick={() => setVisible((shown) => !shown)}
				>
					{visible ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
				</Button>
			</div>
			{showStrength && <StrengthMeter password={value} />}
		</FieldShell>
	);
}

/** Four segments for sighted users; the text is the accessible, translated source of truth. */
function StrengthMeter({ password }: { password: string }) {
	const { t } = useTranslation();
	const score = scorePassword(password);
	return (
		<div className="grid gap-1.5">
			<div className="grid grid-cols-4 gap-1" aria-hidden>
				{SEGMENTS.map((segment) => (
					<span
						key={segment}
						className={cn(
							"h-1 rounded-full transition-colors duration-200",
							password && segment <= Math.max(score, 1)
								? SEGMENT_FILL[score]
								: "bg-border",
						)}
					/>
				))}
			</div>
			<p
				data-testid="password-strength"
				aria-live="polite"
				className="text-muted-foreground text-xs"
			>
				{password &&
					t("form.passwordStrength.label", {
						strength: t(`form.passwordStrength.${score}`),
					})}
			</p>
		</div>
	);
}
