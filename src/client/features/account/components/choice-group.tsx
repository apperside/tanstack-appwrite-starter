import type { LucideIcon } from "lucide-react";
import { useId } from "react";
import { Label } from "#/client/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/client/components/ui/radio-group";

export type Choice<T extends string> = {
	value: T;
	label: string;
	icon?: LucideIcon;
	/** The label's language, when it differs from the page's (a language's own name). */
	lang?: string;
};

/**
 * A radio group of tiles, each a whole clickable label; it acts on every
 * change (arrow keys included), so there is no save button.
 */
export function ChoiceGroup<T extends string>({
	labelledBy,
	value,
	onChange,
	choices,
}: {
	labelledBy: string;
	value: T;
	onChange: (value: T) => void;
	choices: Choice<T>[];
}) {
	const id = useId();
	return (
		<RadioGroup
			aria-labelledby={labelledBy}
			value={value}
			onValueChange={(next) => {
				const choice = choices.find((option) => option.value === next);
				if (choice) onChange(choice.value);
			}}
			className="grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]"
		>
			{choices.map(({ value: option, label, icon: Icon, lang }) => (
				<Label
					key={option}
					htmlFor={`${id}-${option}`}
					className="hover:bg-accent/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/60 min-h-11 cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors"
				>
					<RadioGroupItem id={`${id}-${option}`} value={option} />
					{Icon && (
						<Icon aria-hidden className="text-muted-foreground size-4" />
					)}
					<span lang={lang}>{label}</span>
				</Label>
			))}
		</RadioGroup>
	);
}
