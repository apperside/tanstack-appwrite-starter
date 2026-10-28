/** Up to two initials (first and last word) for an avatar, e.g. "Ada Lovelace" → "AL". */
export function initials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const first = words[0];
	if (!first) return "";
	const last = words.length > 1 ? words[words.length - 1] : "";
	// Spread, not [0]: keeps characters outside the BMP whole.
	return `${[...first][0]}${last ? [...last][0] : ""}`.toUpperCase();
}
