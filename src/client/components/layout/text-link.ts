import { touchTargetClassName } from "./touch-target";

const linkClassName =
	"text-foreground rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/70";

/** A link inside running text (auth footers, hints): underlined on hover, with the app's focus ring. */
export const textLinkClassName = `${linkClassName} ${touchTargetClassName}`;

/** A link standing alone (not inside a sentence): at least 44px tall on touch screens. */
export const standaloneTextLinkClassName = `${linkClassName} pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center`;
