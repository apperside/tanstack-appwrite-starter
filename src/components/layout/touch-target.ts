/**
 * Grows an element's hit area to 44px tall on touch screens without changing
 * its layout: an invisible box centred on it. For targets that must keep their
 * visual size (a link in a sentence, the brand mark).
 */
export const touchTargetClassName =
	"pointer-coarse:relative pointer-coarse:after:absolute pointer-coarse:after:inset-x-0 pointer-coarse:after:top-1/2 pointer-coarse:after:h-11 pointer-coarse:after:-translate-y-1/2";
