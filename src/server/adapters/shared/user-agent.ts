const BROWSERS: [RegExp, string][] = [
	[/Edg\//, "Microsoft Edge"],
	[/Firefox\//, "Firefox"],
	[/Chrome\//, "Chrome"],
	[/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
	[/Android/, "Android"],
	[/iPhone|iPad/, "iOS"],
	[/Mac OS X|Macintosh/, "Mac"],
	[/Windows/, "Windows"],
	[/Linux/, "GNU/Linux"],
];

const match = (list: [RegExp, string][], ua: string) =>
	list.find(([pattern]) => pattern.test(ua))?.[1] ?? "";

/**
 * A rough browser and OS for the sessions list of the self-run backends
 * (memory, Postgres); empty when unknown. Appwrite parses user agents itself.
 */
export function describeUserAgent(userAgent: string | undefined): {
	clientName: string;
	osName: string;
	deviceName: string;
} {
	const ua = userAgent ?? "";
	return {
		clientName: match(BROWSERS, ua),
		osName: match(SYSTEMS, ua),
		deviceName: /Mobile|Android|iPhone/.test(ua)
			? "smartphone"
			: ua
				? "desktop"
				: "",
	};
}
