import { Link } from "@tanstack/react-router";
import { LayersIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "#/lib/cn";
import { touchTargetClassName } from "./touch-target";

/** The app's mark: replace the icon with your logo. */
function BrandMark({ className }: { className?: string }) {
	return (
		<span
			aria-hidden
			className={cn(
				"bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4",
				className,
			)}
		>
			<LayersIcon />
		</span>
	);
}

/** Mark + app name, linking home. */
export function BrandLink({ className }: { className?: string }) {
	const { t } = useTranslation();
	return (
		<Link
			to="/"
			className={cn(
				"flex items-center gap-2.5 rounded-md text-base font-semibold tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/70",
				touchTargetClassName,
				className,
			)}
		>
			<BrandMark />
			<span className="truncate">{t("appName")}</span>
		</Link>
	);
}
