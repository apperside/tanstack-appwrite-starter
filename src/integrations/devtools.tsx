import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

/** Router and query panels. Loaded lazily and only in DEV (see `__root.tsx`). */
export default function AppDevtools() {
	return (
		<TanStackDevtools
			config={{ position: "bottom-right" }}
			plugins={[
				{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
				{ name: "Tanstack Query", render: <ReactQueryDevtoolsPanel /> },
			]}
		/>
	);
}
